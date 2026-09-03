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
    if (links.length === 0) return [];

    const exhibitorIds = links.map((l) => l.exhibitorId);
    const [contacts, members] = await Promise.all([
      this.contactRepo
        .createQueryBuilder('c')
        .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
        .andWhere('c.id IN (:...ids)', { ids: exhibitorIds })
        .getMany(),
      this.memberRepo
        .createQueryBuilder('m')
        .where('m.eventsId = :eventsId', { eventsId: user.eventsId })
        .andWhere('m.exhibitorId IN (:...ids)', { ids: exhibitorIds })
        .getMany(),
    ]);

    return contacts.map((contact) => {
      const member = members.find((m) => m.exhibitorId === contact.id);
      return {
        exhibitorId: contact.id,
        fullname: contact.fullname,
        phone: contact.phone,
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

    const canScan = dto.canScan ?? true;
    const canChat = dto.canChat ?? true;
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
