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
      this.getBoothProfile(user.eventsId, user.companyId),
      this.getLeadsCount(user.eventsId, user.companyId),
      this.getPendingMeetingsCount(user.eventsId, user.companyId),
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

  private async getBoothProfile(eventsId: number, companyId: number | null) {
    if (!companyId) {
      return null;
    }

    const company = await this.companyRepo.findOne({
      where: { eventsId, id: companyId },
    });
    if (!company) return null;

    // Satu company bisa punya beberapa space (lihat exhcompany_space) -
    // ambil semua, gabungkan dengan detail nama/lokasi dari venue_space.
    const companySpaces = await this.companySpaceRepo.find({
      where: { eventsId, companyId },
    });

    const spaceIds = [...new Set(companySpaces.map((cs) => cs.spaceId))];
    const venueSpaces = spaceIds.length
      ? await this.venueSpaceRepo.find({ where: { eventsId } })
      : [];

    const locations = companySpaces.map((cs) => {
      const space = venueSpaces.find(
        (vs) => vs.id === cs.spaceId && vs.venueId === cs.venueId,
      );
      return {
        venueId: cs.venueId,
        spaceId: cs.spaceId,
        spaceName: space?.spaceName ?? null,
        spaceDetails: space?.spaceDetails ?? null,
      };
    });

    return {
      companyId: company.id,
      companyName: company.companyName,
      logo: company.logo,
      locations,
    };
  }

  private async getLeadsCount(eventsId: number, companyId: number | null): Promise<number> {
    if (!companyId) return 0;
    // Distinct guests_id - satu visitor bisa ke-scan lebih dari sekali
    // (misal scan ulang pas tanya-tanya lagi), jangan double count sebagai lead.
    const result = await this.checkinRepo
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.guestsId)', 'count')
      .where('c.eventsId = :eventsId', { eventsId })
      .andWhere('c.companyId = :companyId', { companyId })
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  private async getPendingMeetingsCount(
    eventsId: number,
    companyId: number | null,
  ): Promise<number> {
    if (!companyId) return 0;
    const result = await this.meetingMemberRepo
      .createQueryBuilder('mm')
      .innerJoin(
        EventsMeetingV2,
        'm',
        'm.eventsId = mm.eventsId AND m.id = mm.meetingId',
      )
      .where('mm.eventsId = :eventsId', { eventsId })
      .andWhere('mm.companyId = :companyId', { companyId })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .andWhere('m.approvalStatus = :pending', { pending: 'PE' })
      .getCount();
    return result;
  }
}
