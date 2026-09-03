import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhcompanySpace } from '../venue/entities/exhcompany-space.entity';
import { VenueSpace } from '../venue/entities/venue-space.entity';
import { CheckinBooth } from '../booth/entities/checkin-booth.entity';
import { EventsMeetingV2 } from '../meetings/entities/events-meeting-v2.entity';
import { MeetingMemberV2 } from '../meetings/entities/meeting-member-v2.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

/**
 * Home = representasi untuk SATU booth spesifik (company + venue + space).
 * companyId/venueId/spaceId semuanya sudah fixed di JWT hasil
 * /auth/select-company-booth.
 *
 * Field yang SENGAJA belum diisi (per keputusan Sept 2026, nunggu
 * keputusan lanjutan):
 * - summary.hotLeadsCount: butuh tabel temperature lead (exhibitor_lead)
 *   yang belum dibangun
 * - booth.eventDayProgress ("Hari ke-2 dari 3") & operatingHoursLabel
 *   ("buka sampai 18.00"): events entity belum punya kolom tanggal/jam
 *   operasional yang cukup
 * - summary.unreadChatCount: Chat module (chat_message native) belum
 *   dibangun
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
    @InjectRepository(GuestsTicket)
    private readonly guestsRepo: Repository<GuestsTicket>,
  ) {}

  async getHome(user: CurrentExhibitor) {
    const [booth, leadsToday, leadsTotal, totalMeetings, pendingMeetingsCount, pendingActions] =
      await Promise.all([
        this.getBoothProfile(user),
        this.getLeadsCount(user, true),
        this.getLeadsCount(user, false),
        this.getMeetingsCount(user, null),
        this.getMeetingsCount(user, 'PE'),
        this.getPendingActions(user),
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
        leadsToday,
        leadsTotal,
        hotLeadsCount: null, // TODO: butuh exhibitor_lead (temperature)
        totalMeetings,
        pendingMeetingsCount,
        unreadChatCount: null, // TODO: butuh Chat module
      },
      pendingActions,
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
      // Badge nomor booth = spaceId (bukan nomor urut custom terpisah) -
      // dikonfirmasi Sept 2026.
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
      // Batas "hari ini" pakai kalender Asia/Jakarta, bukan timezone
      // server - dihitung di level SQL supaya tidak tergantung locale Node.
      qb.andWhere(
        `c.checkinDatetime >= date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta')`,
      ).andWhere(
        `c.checkinDatetime < date_trunc('day', now() AT TIME ZONE 'Asia/Jakarta') + interval '1 day'`,
      );
    }

    const result = await qb.getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  private async getMeetingsCount(
    user: CurrentExhibitor,
    approvalStatus: string | null,
  ): Promise<number> {
    const qb = this.meetingMemberRepo
      .createQueryBuilder('mm')
      .innerJoin(EventsMeetingV2, 'm', 'm.eventsId = mm.eventsId AND m.id = mm.meetingId')
      .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('mm.companyId = :companyId', { companyId: user.companyId })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' });

    if (approvalStatus) {
      qb.andWhere('m.approvalStatus = :status', { status: approvalStatus });
    }

    return qb.getCount();
  }

  /**
   * Screen: "Perlu ditindak" - list meeting yang nunggu approval, dengan
   * nama requester (dari guests_ticket) + waktu diminta + suhu meeting
   * (meeting_score, sudah ada di events_meeting_v2 - field ini persis
   * sama fungsinya dengan konsep Hot/Warm/Cold, jadi bisa dipakai
   * langsung tanpa nunggu exhibitor_lead).
   */
  private async getPendingActions(user: CurrentExhibitor) {
    const rows = await this.meetingMemberRepo
      .createQueryBuilder('mm')
      .innerJoin(EventsMeetingV2, 'm', 'm.eventsId = mm.eventsId AND m.id = mm.meetingId')
      .select([
        'm.id AS meeting_id',
        'm.meetingTitle AS meeting_title',
        'm.startDatetime AS start_datetime',
        'm.meetingScore AS meeting_score',
        'mm.guestsId AS requester_guests_id',
      ])
      .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('mm.companyId = :companyId', { companyId: user.companyId })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .andWhere('m.approvalStatus = :status', { status: 'PE' })
      .orderBy('m.startDatetime', 'ASC')
      .limit(20)
      .getRawMany<{
        meeting_id: number;
        meeting_title: string | null;
        start_datetime: Date | null;
        meeting_score: string | null;
        requester_guests_id: number;
      }>();

    if (rows.length === 0) return [];

    const guestIds = [...new Set(rows.map((r) => r.requester_guests_id))];
    const guests = await this.guestsRepo
      .createQueryBuilder('g')
      .where('g.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('g.guestsId IN (:...ids)', { ids: guestIds })
      .getMany();

    return rows.map((r) => {
      const guest = guests.find((g) => g.guestsId === r.requester_guests_id);
      return {
        meetingId: r.meeting_id,
        meetingTitle: r.meeting_title,
        startDatetime: r.start_datetime,
        temperature: r.meeting_score, // Hot/Warm/Cold, dari events_meeting_v2.meeting_score
        requester: {
          guestsId: r.requester_guests_id,
          fullname: guest?.fullname ?? null,
        },
      };
    });
  }
}
