import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorMemberStatus } from '../exhibitors/entities/exhibitor-member-status.entity';
import { ExhibitorMemberAction } from '../exhibitors/entities/exhibitor-member-action.entity';
import { ExhibitorDeviceToken } from '../exhibitors/entities/exhibitor-device-token.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { LoginDto } from './dto/login.dto';
import { SelectCompanyDto } from './dto/select-company.dto';

/** Token identitas SEMENTARA hasil /auth/login - BELUM bisa dipakai akses
 * endpoint manapun selain /auth/select-company. Beda dari JwtPayload biasa:
 * tidak ada companyId/isOwner/canScan/canChat karena itu semua baru
 * ditentukan SETELAH company dipilih (satu exhibitor bisa beda permission
 * di company berbeda kalau nanti membership per-company diterapkan). */
export interface IdentityTokenPayload {
  stage: 'IDENTITY';
  sub: number; // exhibitor_contact.id
  eventsId: number;
  phone: string;
  fullname: string;
}

export interface JwtPayload {
  sub: number;
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
    @InjectRepository(ExhibitorDeviceToken)
    private readonly deviceTokenRepo: Repository<ExhibitorDeviceToken>,
    @InjectRepository(ExhibitorHaveCompany)
    private readonly haveCompanyRepo: Repository<ExhibitorHaveCompany>,
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Screen: Login exhibitor app — event key (6-digit) + nomor HP.
  // TANPA OTP. Langkah 1 dari 2: identitas tervalidasi, tapi belum dapat
  // akses penuh - exhibitor harus pilih company dulu (satu exhibitor bisa
  // mewakili beberapa company, lihat exhibitor_have_company).
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

    if (dto.deviceId) {
      await this.recordDeviceToken(event.id, contact.id, dto.deviceId, dto.platform);
    }

    const companies = await this.getCompaniesForExhibitor(event.id, contact.id);

    const identityPayload: IdentityTokenPayload = {
      stage: 'IDENTITY',
      sub: contact.id,
      eventsId: event.id,
      phone: contact.phone,
      fullname: contact.fullname,
    };
    // Identity token umurnya pendek (5 menit) - cuma dipakai buat jembatan
    // ke /auth/select-company, bukan token sesi.
    const identityToken = await this.jwtService.signAsync(identityPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '5m',
    });

    return {
      identityToken,
      exhibitor: {
        fullname: contact.fullname,
        phone: contact.phone,
        isOwner: member.isOwner === 'Y',
      },
      companies,
    };
  }

  // Screen: Pilih company (kalau exhibitor mewakili >1 company). Langkah
  // 2 dari 2: tukar identityToken + companyId pilihan -> access/refresh
  // token penuh, siap dipakai ke semua endpoint lain.
  async selectCompany(dto: SelectCompanyDto) {
    let identity: IdentityTokenPayload;
    try {
      identity = await this.jwtService.verifyAsync<IdentityTokenPayload>(dto.identityToken, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Identity token tidak valid atau sudah kedaluwarsa, login ulang');
    }
    if (identity.stage !== 'IDENTITY') {
      throw new UnauthorizedException('Token tidak valid untuk langkah ini');
    }

    const allowed = await this.haveCompanyRepo.findOne({
      where: { eventsId: identity.eventsId, exhibitorId: identity.sub, companyId: dto.companyId },
    });
    if (!allowed) {
      throw new ForbiddenException('Kamu tidak terhubung ke company ini');
    }

    // Re-check status (bukan cuma percaya identity token) - status bisa
    // saja berubah di antara langkah login dan select-company.
    const contact = await this.contactRepo.findOne({
      where: { eventsId: identity.eventsId, id: identity.sub },
    });
    if (!contact || contact.approvalStatus !== 'AP') {
      throw new UnauthorizedException('Akun exhibitor tidak valid');
    }
    const member = await this.memberRepo.findOne({
      where: { eventsId: identity.eventsId, exhibitorId: identity.sub },
    });
    if (!member || member.memberStatus === 'REMOVED') {
      throw new ForbiddenException('Akses kamu sudah dicabut');
    }

    return this.buildTokenResponse(identity.eventsId, dto.companyId, contact, member);
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
    const allowed = await this.haveCompanyRepo.findOne({
      where: { eventsId: payload.eventsId, exhibitorId: payload.sub, companyId: payload.companyId },
    });
    if (!allowed) {
      throw new ForbiddenException('Kamu tidak lagi terhubung ke company ini');
    }
    const member = await this.memberRepo.findOne({
      where: { eventsId: payload.eventsId, exhibitorId: contact.id },
    });
    if (!member || member.memberStatus === 'REMOVED') {
      throw new ForbiddenException('Akses kamu untuk booth ini sudah dicabut');
    }

    return this.buildTokenResponse(payload.eventsId, payload.companyId, contact, member);
  }

  private async getCompaniesForExhibitor(eventsId: number, exhibitorId: number) {
    const links = await this.haveCompanyRepo.find({ where: { eventsId, exhibitorId } });
    if (links.length === 0) return [];

    const companyIds = links.map((l) => l.companyId);
    const companies = await this.companyRepo
      .createQueryBuilder('c')
      .where('c.eventsId = :eventsId', { eventsId })
      .andWhere('c.id IN (:...companyIds)', { companyIds })
      .getMany();

    return companies.map((c) => ({
      companyId: c.id,
      companyName: c.companyName,
      logo: c.logo,
    }));
  }

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
    return Array.from(variants);
  }

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

  private async recordDeviceToken(
    eventsId: number,
    exhibitorId: number,
    deviceId: string,
    platform?: string,
  ) {
    const now = new Date();
    const existing = await this.deviceTokenRepo.findOne({
      where: { eventsId, exhibitorId, deviceId },
    });
    if (existing) {
      existing.lastSeenAt = now;
      if (platform) existing.platform = platform;
      await this.deviceTokenRepo.save(existing);
    } else {
      await this.deviceTokenRepo.save(
        this.deviceTokenRepo.create({
          eventsId,
          exhibitorId,
          deviceId,
          platform: platform ?? null,
          createdAt: now,
          lastSeenAt: now,
        }),
      );
    }
  }

  private async buildTokenResponse(
    eventsId: number,
    companyId: number,
    contact: ExhibitorContact,
    member: ExhibitorMemberStatus,
  ) {
    const payload: JwtPayload = {
      sub: contact.id,
      eventsId,
      companyId,
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
        eventsId,
        companyId,
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
