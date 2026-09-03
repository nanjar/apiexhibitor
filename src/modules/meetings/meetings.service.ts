import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsMeetingV2 } from './entities/events-meeting-v2.entity';
import { MeetingMemberV2 } from './entities/meeting-member-v2.entity';
import { ExhibitorMeetingAction } from './entities/exhibitor-meeting-action.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { MeetingActionDto } from './dto/meeting-action.dto';

/**
 * Meeting scope-nya per COMPANY (meeting_member_v2 gak punya venue_id/
 * space_id di skemanya), sama seperti User Management - bukan per booth
 * spesifik.
 *
 * Approve/reject: tulis LANGSUNG ke mirror Postgres events_meeting_v2
 * (supaya UI approver sendiri langsung reflect, gak nunggu round-trip
 * push-job -> MySQL -> pull-sync ~6 menit) DAN antre ke staging
 * ExhibitorMeetingAction (supaya MySQL beneran ke-update, karena admin
 * panel PHP legacy masih baca approval_status ini langsung).
 */
@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(EventsMeetingV2)
    private readonly meetingRepo: Repository<EventsMeetingV2>,
    @InjectRepository(MeetingMemberV2)
    private readonly meetingMemberRepo: Repository<MeetingMemberV2>,
    @InjectRepository(ExhibitorMeetingAction)
    private readonly meetingActionRepo: Repository<ExhibitorMeetingAction>,
    @InjectRepository(GuestsTicket)
    private readonly guestsRepo: Repository<GuestsTicket>,
  ) {}

  async list(user: CurrentExhibitor, status?: string) {
    const qb = this.meetingMemberRepo
      .createQueryBuilder('mm')
      .innerJoin(EventsMeetingV2, 'm', 'm.eventsId = mm.eventsId AND m.id = mm.meetingId')
      .select([
        'm.id AS meeting_id',
        'm.meetingTitle AS meeting_title',
        'm.startDatetime AS start_datetime',
        'm.endDatetime AS end_datetime',
        'm.approvalStatus AS approval_status',
        'm.status AS status',
        'm.meetingScore AS meeting_score',
        'mm.guestsId AS requester_guests_id',
      ])
      .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('mm.companyId = :companyId', { companyId: user.companyId })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .orderBy('m.startDatetime', 'ASC');

    if (status) {
      qb.andWhere('m.approvalStatus = :status', { status });
    }

    const rows = await qb.getRawMany<{
      meeting_id: number;
      meeting_title: string | null;
      start_datetime: Date | null;
      end_datetime: Date | null;
      approval_status: string;
      status: string | null;
      meeting_score: string | null;
      requester_guests_id: number;
    }>();

    return this.attachRequesterNames(user.eventsId, rows);
  }

  async detail(user: CurrentExhibitor, meetingId: number) {
    const meeting = await this.meetingRepo.findOne({
      where: { eventsId: user.eventsId, id: meetingId },
    });
    if (!meeting) throw new NotFoundException('Meeting tidak ditemukan');

    const membership = await this.meetingMemberRepo.findOne({
      where: {
        eventsId: user.eventsId,
        meetingId,
        companyId: user.companyId,
        usertypeId: 'EX',
      },
    });
    if (!membership) throw new NotFoundException('Meeting ini bukan untuk company kamu');

    const guest = await this.guestsRepo.findOne({
      where: { eventsId: user.eventsId, guestsId: membership.guestsId },
    });

    return {
      meetingId: meeting.id,
      meetingTitle: meeting.meetingTitle,
      startDatetime: meeting.startDatetime,
      endDatetime: meeting.endDatetime,
      approvalStatus: meeting.approvalStatus,
      status: meeting.status,
      temperature: meeting.meetingScore,
      requester: {
        guestsId: membership.guestsId,
        fullname: guest?.fullname ?? null,
      },
    };
  }

  async approve(user: CurrentExhibitor, meetingId: number, dto: MeetingActionDto) {
    return this.applyDecision(user, meetingId, 'APPROVE', dto.notes);
  }

  async reject(user: CurrentExhibitor, meetingId: number, dto: MeetingActionDto) {
    return this.applyDecision(user, meetingId, 'REJECT', dto.notes);
  }

  private async applyDecision(
    user: CurrentExhibitor,
    meetingId: number,
    action: 'APPROVE' | 'REJECT',
    notes?: string,
  ) {
    const membership = await this.meetingMemberRepo.findOne({
      where: {
        eventsId: user.eventsId,
        meetingId,
        companyId: user.companyId,
        usertypeId: 'EX',
      },
    });
    if (!membership) {
      throw new BadRequestException('Meeting ini bukan untuk company kamu');
    }

    const meeting = await this.meetingRepo.findOne({
      where: { eventsId: user.eventsId, id: meetingId },
    });
    if (!meeting) throw new NotFoundException('Meeting tidak ditemukan');
    if (meeting.approvalStatus !== 'PE') {
      throw new ConflictException(
        `Meeting ini sudah diproses sebelumnya (status: ${meeting.approvalStatus})`,
      );
    }

    const approvalStatus = action === 'APPROVE' ? 'AP' : 'CL';
    const status = action === 'APPROVE' ? 'OPEN' : 'CANCEL';

    // Optimistic write ke mirror - nilai yang ditulis SAMA PERSIS dengan
    // yang bakal ditulis push-job ke MySQL, jadi pull-sync berikutnya
    // cuma konfirmasi, bukan menimpa balik dengan nilai beda.
    meeting.approvalStatus = approvalStatus;
    meeting.status = status;
    await this.meetingRepo.save(meeting);

    await this.meetingActionRepo.save(
      this.meetingActionRepo.create({
        eventsId: user.eventsId,
        meetingId,
        action,
        actorExhibitorId: user.exhibitorId,
        notes: notes ?? null,
        createdAt: new Date(),
      }),
    );

    return { meetingId, approvalStatus, status };
  }

  private async attachRequesterNames<
    T extends { requester_guests_id: number },
  >(eventsId: number, rows: T[]) {
    if (rows.length === 0) return [];

    const guestIds = [...new Set(rows.map((r) => r.requester_guests_id))];
    const guests = await this.guestsRepo
      .createQueryBuilder('g')
      .where('g.eventsId = :eventsId', { eventsId })
      .andWhere('g.guestsId IN (:...ids)', { ids: guestIds })
      .getMany();

    return rows.map((r: any) => {
      const guest = guests.find((g) => g.guestsId === r.requester_guests_id);
      return {
        meetingId: r.meeting_id,
        meetingTitle: r.meeting_title,
        startDatetime: r.start_datetime,
        endDatetime: r.end_datetime,
        approvalStatus: r.approval_status,
        status: r.status,
        temperature: r.meeting_score,
        requester: {
          guestsId: r.requester_guests_id,
          fullname: guest?.fullname ?? null,
        },
      };
    });
  }
}
