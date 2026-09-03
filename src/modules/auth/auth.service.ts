import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorMemberStatus } from '../exhibitors/entities/exhibitor-member-status.entity';
import { ExhibitorMemberAction } from '../exhibitors/entities/exhibitor-member-action.entity';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: number; // exhibitor_contact.id (== exhibitor_id di tabel lain)
  eventsId: number;
  companyId: number;
  phone: string;
  fullname: string;
  isOwner: boolean;
  canScan: boolean;
  canChat: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(ExhibitorContact)
    private readonly contactRepo: Repository<ExhibitorContact>,
    @InjectRepository(ExhibitorMemberStatus)
    private readonly memberRepo: Repository<ExhibitorMemberStatus>,
    @InjectRepository(ExhibitorMemberAction)
    private readonly memberActionRepo: Repository<ExhibitorMemberAction>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Screen: Login exhibitor app — event key (6-digit) + nomor HP.
  // TANPA OTP (keputusan Sept 2026: low-stakes internal tool untuk staff
  // booth, cukup nomor HP yang sudah terdaftar admin/organizer).
  async login(dto: LoginDto) {
    const event = await this.eventRepo.findOne({ where: { evToken: dto.eventKey } });
    if (!event) {
      throw new UnauthorizedException('Event key tidak valid');
    }

    const normalizedPhone = this.normalizePhone(dto.phone);
    const contact = await this.findContactByPhone(event.id, normalizedPhone);
    if (!contact) {
      throw new UnauthorizedException('Nomor HP tidak terdaftar sebagai staff booth di event ini');
    }
    if (contact.approvalStatus !== 'AP') {
      throw new UnauthorizedException('Akun exhibitor kamu belum disetujui admin');
    }

    const member = await this.resolveMembership(event.id, contact);
    if (member.memberStatus === 'REMOVED') {
      throw new ForbiddenException(
        'Akses kamu untuk booth ini sudah dicabut. Hubungi pemilik booth kalau ini keliru.',
      );
    }

    return this.buildTokenResponse(event, contact, member);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid atau sudah kedaluwarsa');
    }

    const contact = await this.contactRepo.findOne({
      where: { eventsId: payload.eventsId, id: payload.sub },
    });
    if (!contact) {
      throw new UnauthorizedException('Akun exhibitor tidak ditemukan');
    }

    const member = await this.memberRepo.findOne({
      where: { eventsId: payload.eventsId, exhibitorId: contact.id },
    });
    if (!member || member.memberStatus === 'REMOVED') {
      throw new ForbiddenException('Akses kamu untuk booth ini sudah dicabut');
    }

    const event = await this.eventRepo.findOne({ where: { id: payload.eventsId } });
    return this.buildTokenResponse(event!, contact, member);
  }

  /**
   * Cari kontak berdasarkan nomor HP. Coba beberapa variasi format
   * (dengan/tanpa 0 di depan, dengan/tanpa 62) karena data phone di MySQL
   * legacy kemungkinan besar tidak konsisten formatnya.
   */
  private async findContactByPhone(
    eventsId: number,
    normalizedPhone: string,
  ): Promise<ExhibitorContact | null> {
    const candidates = this.phoneVariants(normalizedPhone);
    for (const candidate of candidates) {
      const found = await this.contactRepo.findOne({
        where: { eventsId, phone: candidate },
      });
      if (found) return found;
    }
    return null;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  private phoneVariants(digitsOnly: string): string[] {
    const variants = new Set<string>([digitsOnly]);
    if (digitsOnly.startsWith('0')) {
      variants.add('62' + digitsOnly.slice(1));
      variants.add('+62' + digitsOnly.slice(1));
    }
    if (digitsOnly.startsWith('62')) {
      variants.add('0' + digitsOnly.slice(2));
      variants.add('+' + digitsOnly);
    }
    if (digitsOnly.startsWith('620')) {
      // hindari salah normalisasi 62 + 0xxx jadi double
      variants.delete('62' + digitsOnly.slice(1));
    }
    return Array.from(variants);
  }

  /**
   * Ambil status membership. Kalau BELUM ADA SAMA SEKALI (login pertama
   * kali exhibitor ini di apiexhibitor) atau statusnya masih INVITED,
   * lakukan bootstrap/activate LANGSUNG ke mirror Postgres supaya sesi
   * ini langsung bisa dipakai (tidak nunggu push-job 1 menit), SEKALIGUS
   * antre ke staging (ExhibitorMemberAction) supaya MySQL ikut update
   * dalam <=1 menit.
   *
   * Ini SATU-SATUNYA pengecualian di seluruh sistem yang menulis langsung
   * ke tabel mirror - aman karena baris yang ditulis baru/computed
   * konsisten dengan apa yang akan ditulis MySQL, jadi pull-sync
   * berikutnya cuma mengonfirmasi, bukan menimpa balik.
   */
  private async resolveMembership(
    eventsId: number,
    contact: ExhibitorContact,
  ): Promise<ExhibitorMemberStatus> {
    let member = await this.memberRepo.findOne({
      where: { eventsId, exhibitorId: contact.id },
    });

    const now = new Date();

    if (!member) {
      const isOwner = contact.userLevel === 'ADM' ? 'Y' : 'N';
      member = this.memberRepo.create({
        eventsId,
        exhibitorId: contact.id,
        memberStatus: 'ACTIVE',
        canScan: 'Y',
        canChat: 'Y',
        isOwner,
        activatedAt: now,
        lastUpdate: now,
      });
      await this.memberRepo.save(member);
      await this.queuePushAction(eventsId, contact.id, 'ACTIVATE', contact.id, 'Y', 'Y');
    } else if (member.memberStatus === 'INVITED') {
      member.memberStatus = 'ACTIVE';
      member.activatedAt = now;
      member.lastUpdate = now;
      await this.memberRepo.save(member);
      await this.queuePushAction(
        eventsId,
        contact.id,
        'ACTIVATE',
        contact.id,
        member.canScan,
        member.canChat,
      );
    }

    return member;
  }

  private async queuePushAction(
    eventsId: number,
    exhibitorId: number,
    action: ExhibitorMemberAction['action'],
    actorExhibitorId: number,
    canScan: string | null,
    canChat: string | null,
  ) {
    await this.memberActionRepo.save(
      this.memberActionRepo.create({
        eventsId,
        exhibitorId,
        action,
        actorExhibitorId,
        canScan,
        canChat,
        createdAt: new Date(),
      }),
    );
  }

  private async buildTokenResponse(
    event: Event,
    contact: ExhibitorContact,
    member: ExhibitorMemberStatus,
  ) {
    const payload: JwtPayload = {
      sub: contact.id,
      eventsId: event.id,
      companyId: contact.companyId,
      phone: contact.phone,
      fullname: contact.fullname,
      isOwner: member.isOwner === 'Y',
      canScan: member.canScan === 'Y',
      canChat: member.canChat === 'Y',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      exhibitor: {
        id: contact.id,
        eventsId: event.id,
        companyId: contact.companyId,
        fullname: contact.fullname,
        phone: contact.phone,
        jobTitle: contact.jobTitle,
        isOwner: member.isOwner === 'Y',
        canScan: member.canScan === 'Y',
        canChat: member.canChat === 'Y',
      },
    };
  }
}
