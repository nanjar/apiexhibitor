import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { ExhibitorMemberStatus } from '../exhibitors/entities/exhibitor-member-status.entity';
import { ExhibitorMemberAction } from '../exhibitors/entities/exhibitor-member-action.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CreateMemberDto } from './dto/create-member.dto';

/**
 * Keanggotaan (exhibitor_member_status_sync) itu scope-nya per COMPANY,
 * bukan per booth spesifik - satu orang bisa kerja di beberapa booth
 * dalam company yang sama dengan permission yang sama. Beda dengan Home
 * yang scope-nya per booth (venue+space).
 *
 * Semua perubahan (invite/activate/remove/restore/update permission)
 * ditulis LANGSUNG ke mirror Postgres (supaya UI langsung reflect) DAN
 * diantre ke staging ExhibitorMemberAction (supaya MySQL ikut ter-update
 * <=1 menit via push-job) - pola yang sama seperti bootstrap login.
 */
@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(ExhibitorContact)
    private readonly contactRepo: Repository<ExhibitorContact>,
    @InjectRepository(ExhibitorHaveCompany)
    private readonly haveCompanyRepo: Repository<ExhibitorHaveCompany>,
    @InjectRepository(ExhibitorMemberStatus)
    private readonly memberRepo: Repository<ExhibitorMemberStatus>,
    @InjectRepository(ExhibitorMemberAction)
    private readonly memberActionRepo: Repository<ExhibitorMemberAction>,
  ) {}

  async listMembers(user: CurrentExhibitor) {
    const links = await this.haveCompanyRepo.find({
      where: { eventsId: user.eventsId, companyId: user.companyId },
    });

    const exhibitorIds = links.map((l) => l.exhibitorId);
    const [contacts, members, pendingCreates] = await Promise.all([
      exhibitorIds.length
        ? this.contactRepo
            .createQueryBuilder('c')
            .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('c.id IN (:...ids)', { ids: exhibitorIds })
            .getMany()
        : Promise.resolve([]),
      exhibitorIds.length
        ? this.memberRepo
            .createQueryBuilder('m')
            .where('m.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('m.exhibitorId IN (:...ids)', { ids: exhibitorIds })
            .getMany()
        : Promise.resolve([]),
      // Orang baru yang di-create tapi belum pulang lewat pull-sync -
      // exhibitor_have_company-nya belum ada, jadi gak akan kejaring lewat
      // links di atas. Ditampilkan terpisah sebagai "pending".
      this.memberActionRepo.find({
        where: { eventsId: user.eventsId, companyId: user.companyId, action: 'CREATE' },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const confirmed = contacts.map((contact) => {
      const member = members.find((m) => m.exhibitorId === contact.id);
      return {
        pending: false,
        exhibitorId: contact.id,
        fullname: contact.fullname,
        phone: contact.phone,
        email: contact.exhibitorEmail,
        jobTitle: contact.jobTitle,
        userLevel: contact.userLevel,
        // NOT_INVITED = terdaftar di exhibitor_have_company (boleh akses
        // company ini) tapi belum pernah di-invite ke exhibitor app sama
        // sekali - beda dari INVITED (sudah diundang, nunggu aktivasi).
        memberStatus: member?.memberStatus ?? 'NOT_INVITED',
        isOwner: member?.isOwner === 'Y',
        canScan: member?.canScan === 'Y',
        canChat: member?.canChat === 'Y',
      };
    });

    // Match pending ke confirmed by createdAt (presisi detik, sama seperti
    // correlationKey di BoothService) supaya orang yang barusan di-create
    // gak dobel muncul begitu pull-sync selesai membawanya balik.
    const confirmedContactCreatedSeconds = new Set(
      contacts.filter((c) => c.created).map((c) => Math.floor(new Date(c.created!).getTime() / 1000)),
    );
    const pendingOnly = pendingCreates.filter(
      (p) => !confirmedContactCreatedSeconds.has(Math.floor(new Date(p.createdAt).getTime() / 1000)),
    );

    const pendingItems = pendingOnly.map((p) => ({
      pending: true,
      exhibitorId: null,
      fullname: p.fullname,
      phone: p.phone,
      email: p.exhibitorEmail,
      jobTitle: p.jobTitle,
      userLevel: p.userLevel,
      memberStatus: 'INVITED' as const,
      isOwner: false,
      canScan: p.canScan === 'Y',
      canChat: p.canChat === 'Y',
    }));

    return [...pendingItems, ...confirmed];
  }

  async invite(user: CurrentExhibitor, dto: InviteMemberDto) {
    const allowed = await this.haveCompanyRepo.findOne({
      where: { eventsId: user.eventsId, exhibitorId: dto.exhibitorId, companyId: user.companyId },
    });
    if (!allowed) {
      throw new BadRequestException(
        'Exhibitor ini belum terhubung ke company kamu (exhibitor_have_company). Hubungi admin untuk menghubungkan dulu.',
      );
    }

    const contact = await this.contactRepo.findOne({
      where: { eventsId: user.eventsId, id: dto.exhibitorId },
    });
    if (!contact) {
      throw new NotFoundException('Exhibitor tidak ditemukan');
    }

    let member = await this.memberRepo.findOne({
      where: { eventsId: user.eventsId, exhibitorId: dto.exhibitorId },
    });
    if (member && member.memberStatus !== 'REMOVED') {
      throw new ConflictException('Exhibitor ini sudah jadi anggota (atau masih diundang)');
    }

    // OPR permission-nya FIXED (scan only), sama seperti di updatePermission().
    if (dto.canChat === true && contact.userLevel === 'OPR') {
      throw new BadRequestException(
        'Exhibitor dengan user_level OPR cuma boleh scan QR, tidak bisa diberi akses chat',
      );
    }

    const canScan = dto.canScan ?? true;
    const canChat = contact.userLevel === 'OPR' ? false : dto.canChat ?? true;
    const now = new Date();

    if (member) {
      member.memberStatus = 'INVITED';
      member.canScan = canScan ? 'Y' : 'N';
      member.canChat = canChat ? 'Y' : 'N';
      member.invitedBy = user.exhibitorId;
      member.invitedAt = now;
      member.removedAt = null;
      member.lastUpdate = now;
    } else {
      member = this.memberRepo.create({
        eventsId: user.eventsId,
        exhibitorId: dto.exhibitorId,
        memberStatus: 'INVITED',
        canScan: canScan ? 'Y' : 'N',
        canChat: canChat ? 'Y' : 'N',
        isOwner: 'N',
        invitedBy: user.exhibitorId,
        invitedAt: now,
        lastUpdate: now,
      });
    }
    await this.memberRepo.save(member);

    await this.queuePushAction(
      user.eventsId,
      dto.exhibitorId,
      'INVITE',
      user.exhibitorId,
      member.canScan,
      member.canChat,
    );

    return { exhibitorId: dto.exhibitorId, memberStatus: 'INVITED', canScan, canChat };
  }

  /**
   * Tambah orang BARU yang belum pernah terdaftar di exhibitor_contact
   * sama sekali (beda dari invite() yang butuh row exhibitor_contact +
   * exhibitor_have_company yang sudah ada duluan). id-nya (auto-increment
   * MySQL) belum diketahui di sini - baru ke-assign saat push-job jalan,
   * lalu balik lagi ke Postgres lewat pull-sync (≤6 menit total: push
   * ≤1 menit + pull 5 menit). Selama itu, tampil sebagai "pending" di
   * listMembers() (lihat correlationKey di sana).
   *
   * userLevel SELALU 'OPR' - exhibitor app cuma boleh bikin akun operator
   * (bukan ADM, yang murni domain panel admin PHP lama). OPR permission-nya
   * FIXED: cuma bisa scan QR (canScan=Y), TIDAK bisa chat (canChat=N) -
   * bukan pilihan yang bisa diubah lewat DTO, lihat juga guard di
   * updatePermission().
   */
  async createNewMember(user: CurrentExhibitor, dto: CreateMemberDto) {
    const now = new Date();

    const action = this.memberActionRepo.create({
      eventsId: user.eventsId,
      companyId: user.companyId,
      exhibitorId: null,
      action: 'CREATE',
      actorExhibitorId: user.exhibitorId,
      canScan: 'Y',
      canChat: 'N',
      fullname: dto.fullname,
      countryCode: dto.countryCode ?? '62',
      phone: dto.phone,
      jobTitle: dto.jobTitle ?? null,
      exhibitorEmail: dto.email,
      userLevel: 'OPR',
      createdAt: now,
    });
    await this.memberActionRepo.save(action);

    return {
      pending: true,
      actionId: action.id,
      fullname: dto.fullname,
      phone: dto.phone,
      email: dto.email,
      userLevel: 'OPR',
      memberStatus: 'INVITED',
      canScan: true,
      canChat: false,
    };
  }

  async remove(user: CurrentExhibitor, exhibitorId: number) {
    if (exhibitorId === user.exhibitorId) {
      throw new BadRequestException('Tidak bisa menghapus diri sendiri dari booth');
    }

    const member = await this.getMemberOrThrow(user.eventsId, exhibitorId);
    if (member.memberStatus === 'REMOVED') {
      throw new ConflictException('Exhibitor ini sudah dihapus sebelumnya');
    }

    member.memberStatus = 'REMOVED';
    member.removedAt = new Date();
    member.lastUpdate = new Date();
    await this.memberRepo.save(member);

    await this.queuePushAction(user.eventsId, exhibitorId, 'REMOVE', user.exhibitorId, null, null);

    return { exhibitorId, memberStatus: 'REMOVED' };
  }

  async restore(user: CurrentExhibitor, exhibitorId: number) {
    const member = await this.getMemberOrThrow(user.eventsId, exhibitorId);
    if (member.memberStatus !== 'REMOVED') {
      throw new ConflictException('Exhibitor ini tidak dalam status dihapus');
    }

    member.memberStatus = 'ACTIVE';
    member.removedAt = null;
    member.lastUpdate = new Date();
    await this.memberRepo.save(member);

    await this.queuePushAction(user.eventsId, exhibitorId, 'RESTORE', user.exhibitorId, null, null);

    return { exhibitorId, memberStatus: 'ACTIVE' };
  }

  async updatePermission(user: CurrentExhibitor, exhibitorId: number, dto: UpdatePermissionDto) {
    if (dto.canScan === undefined && dto.canChat === undefined) {
      throw new BadRequestException('Minimal satu dari canScan/canChat harus diisi');
    }

    const member = await this.getMemberOrThrow(user.eventsId, exhibitorId);
    if (member.memberStatus === 'REMOVED') {
      throw new ConflictException('Tidak bisa ubah permission exhibitor yang sudah dihapus');
    }

    // OPR permission-nya FIXED (scan only) - jangan biarkan siapa pun
    // (termasuk owner) menyalakan chat untuk exhibitor level OPR.
    if (dto.canChat === true) {
      const contact = await this.contactRepo.findOne({
        where: { eventsId: user.eventsId, id: exhibitorId },
      });
      if (contact?.userLevel === 'OPR') {
        throw new BadRequestException(
          'Exhibitor dengan user_level OPR cuma boleh scan QR, tidak bisa diberi akses chat',
        );
      }
    }

    if (dto.canScan !== undefined) member.canScan = dto.canScan ? 'Y' : 'N';
    if (dto.canChat !== undefined) member.canChat = dto.canChat ? 'Y' : 'N';
    member.lastUpdate = new Date();
    await this.memberRepo.save(member);

    await this.queuePushAction(
      user.eventsId,
      exhibitorId,
      'UPDATE_PERMISSION',
      user.exhibitorId,
      dto.canScan !== undefined ? member.canScan : null,
      dto.canChat !== undefined ? member.canChat : null,
    );

    return {
      exhibitorId,
      canScan: member.canScan === 'Y',
      canChat: member.canChat === 'Y',
    };
  }

  private async getMemberOrThrow(eventsId: number, exhibitorId: number): Promise<ExhibitorMemberStatus> {
    const member = await this.memberRepo.findOne({ where: { eventsId, exhibitorId } });
    if (!member) {
      throw new NotFoundException('Exhibitor ini belum pernah jadi anggota (belum di-invite)');
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
}
