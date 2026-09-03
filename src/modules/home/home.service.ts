import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhcompanySpace } from '../venue/entities/exhcompany-space.entity';
import { VenueSpace } from '../venue/entities/venue-space.entity';
import { CheckinBooth } from '../booth/entities/checkin-booth.entity';
import { EventsMeetingV2 } from '../meetings/entities/events-meeting-v2.entity';
import { MeetingMemberV2 } from '../meetings/entities/meeting-member-v2.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

/**
 * Home = representasi untuk SATU booth spesifik (company + venue + space),
 * bukan company secara umum - keputusan Sept 2026 setelah ketahuan satu
 * company bisa punya beberapa booth di lapangan. companyId/venueId/spaceId
 * semuanya sudah fixed di JWT hasil /auth/select-company-booth, jadi di sini
 * tinggal dipakai langsung, tidak perlu re-resolve daftar lokasi lagi.
 */
@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
    @InjectRepository(ExhcompanySpace)
    private readonly companySpaceRepo: Repository<ExhcompanySpace>,
    @InjectRepository(VenueSpace)
    private readonly venueSpaceRepo: Repository<VenueSpace>,
    @InjectRepository(CheckinBooth)
    private readonly checkinRepo: Repository<CheckinBooth>,
    @InjectRepository(MeetingMemberV2)
    private readonly meetingMemberRepo: Repository<MeetingMemberV2>,
  ) {}

  async getHome(user: CurrentExhibitor) {
    const [booth, leadsCount, pendingMeetingsCount] = await Promise.all([
      this.getBoothProfile(user),
      this.getLeadsCount(user),
      this.getPendingMeetingsCount(user),
    ]);

    return {
      eventsId: user.eventsId,
      exhibitor: {
        fullname: user.fullname,
        isOwner: user.isOwner,
        canScan: user.canScan,
        canChat: user.canChat,
      },
      booth,
      summary: {
        leadsCount,
        pendingMeetingsCount,
        // Unread chat belum tersedia - Chat module (chat_message native)
        // belum dibangun, jadi belum ada mekanisme "sudah dibaca sampai
        // mana" per exhibitor member. Menyusul begitu modul Chat ada.
        unreadChatCount: null,
      },
    };
  }

  private async getBoothProfile(user: CurrentExhibitor) {
    const [company, companySpace] = await Promise.all([
      this.companyRepo.findOne({ where: { eventsId: user.eventsId, id: user.companyId } }),
      this.companySpaceRepo.findOne({
        where: {
          eventsId: user.eventsId,
          companyId: user.companyId,
          venueId: user.venueId,
          spaceId: user.spaceId,
        },
      }),
    ]);
    if (!company || !companySpace) return null;

    const space = await this.venueSpaceRepo.findOne({
      where: { eventsId: user.eventsId, id: user.spaceId, venueId: user.venueId },
    });

    return {
      companyId: company.id,
      companyName: company.companyName,
      logo: company.logo,
      venueId: user.venueId,
      spaceId: user.spaceId,
      spaceName: space?.spaceName ?? null,
      spaceDetails: space?.spaceDetails ?? null,
    };
  }

  private async getLeadsCount(user: CurrentExhibitor): Promise<number> {
    // Scope ke booth spesifik (venue+space), bukan seluruh company - kalau
    // company punya beberapa booth, lead masing-masing booth dihitung
    // terpisah, konsisten dengan "Home representasi untuk booth tertentu".
    const result = await this.checkinRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.guestsId)', 'count')
      .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('c.companyId = :companyId', { companyId: user.companyId })
      .andWhere('c.venueId = :venueId', { venueId: user.venueId })
      .andWhere('c.spaceId = :spaceId', { spaceId: user.spaceId })
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  private async getPendingMeetingsCount(user: CurrentExhibitor): Promise<number> {
    // CATATAN: meeting_member_v2 cuma punya company_id, TIDAK ada
    // venue_id/space_id - jadi meeting pending scope-nya masih per
    // company, belum bisa dipersempit ke booth spesifik dari sisi data.
    const result = await this.meetingMemberRepo
      .createQueryBuilder('mm')
      .innerJoin(
        EventsMeetingV2,
        'm',
        'm.eventsId = mm.eventsId AND m.id = mm.meetingId',
      )
      .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('mm.companyId = :companyId', { companyId: user.companyId })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .andWhere('m.approvalStatus = :pending', { pending: 'PE' })
      .getCount();
    return result;
  }
}
