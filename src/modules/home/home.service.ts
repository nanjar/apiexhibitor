import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhcompanySpace } from '../venue/entities/exhcompany-space.entity';
import { VenueSpace } from '../venue/entities/venue-space.entity';
import { CheckinBooth } from '../booth/entities/checkin-booth.entity';
import { MeetingsService } from '../meetings/meetings.service';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

/**
 * Home = representasi untuk SATU booth spesifik (company + venue + space).
 *
 * Meeting count & pendingActions SENGAJA delegasi ke MeetingsService,
 * BUKAN query sendiri - supaya logic "meeting ini punya company siapa"
 * (via exhibitor_have_company, BUKAN kolom meeting_member_v2.company_id
 * yang tidak reliable) cuma ada di SATU tempat. Digabung dari 2 tab
 * (visitor + exhibitor) karena Home representasi keseluruhan, bukan per-tab.
 *
 * Field yang SENGAJA belum diisi (per keputusan Sept 2026, nunggu
 * keputusan lanjutan):
 * - summary.hotLeadsCount: butuh tabel temperature lead (exhibitor_lead)
 * - booth.eventDayProgress & operatingHoursLabel: events entity belum
 *   punya kolom tanggal/jam operasional yang cukup
 * - summary.unreadChatCount: Chat module belum dibangun
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
    private readonly meetingsService: MeetingsService,
  ) {}

  async getHome(user: CurrentExhibitor) {
    const [booth, leadsToday, leadsTotal, visitorMeetings, exhibitorMeetings] = await Promise.all([
      this.getBoothProfile(user),
      this.getLeadsCount(user, true),
      this.getLeadsCount(user, false),
      this.meetingsService.list(user, 'visitor'),
      this.meetingsService.list(user, 'exhibitor'),
    ]);

    const allMeetings = [...visitorMeetings, ...exhibitorMeetings];
    const pendingMeetings = allMeetings
      .filter((m) => m.approvalStatus === 'PE')
      .sort((a, b) => (a.startDatetime && b.startDatetime ? +new Date(a.startDatetime) - +new Date(b.startDatetime) : 0))
      .slice(0, 20);

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
        leadsToday,
        leadsTotal,
        hotLeadsCount: null, // TODO: butuh exhibitor_lead (temperature)
        totalMeetings: allMeetings.length,
        pendingMeetingsCount: pendingMeetings.length,
        unreadChatCount: null, // TODO: butuh Chat module
      },
      // Setiap item punya counterpart.type ('visitor'/'exhibitor') supaya
      // UI tahu mau di-route ke tab mana kalau di-tap.
      pendingActions: pendingMeetings,
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
      boothNumber: String(user.spaceId).padStart(2, '0'),
      spaceName: space?.spaceName ?? null,
      spaceDetails: space?.spaceDetails ?? null,
    };
  }

  private async getLeadsCount(user: CurrentExhibitor, todayOnly: boolean): Promise<number> {
    const qb = this.checkinRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.guestsId)', 'count')
      .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('c.companyId = :companyId', { companyId: user.companyId })
      .andWhere('c.venueId = :venueId', { venueId: user.venueId })
      .andWhere('c.spaceId = :spaceId', { spaceId: user.spaceId });

    if (todayOnly) {
      qb.andWhere(
        `c.checkinDatetime >= date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta')`,
      ).andWhere(
        `c.checkinDatetime < date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') + interval '1 day'`,
      );
    }

    const result = await qb.getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }
}
