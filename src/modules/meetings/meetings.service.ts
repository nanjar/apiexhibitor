import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { EventsMeetingV2 } from './entities/events-meeting-v2.entity';
import { MeetingMemberV2 } from './entities/meeting-member-v2.entity';
import { ExhibitorMeetingAction } from './entities/exhibitor-meeting-action.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { ApproveMeetingDto } from './dto/approve-meeting.dto';
import { RejectMeetingDto } from './dto/reject-meeting.dto';

export type MeetingTabType = 'visitor' | 'exhibitor';

/**
 * KOREKSI PENTING #2 (Sept 2026): ketahuan AppointmentsService.create()
 * di apivisitor TIDAK PERNAH insert ke meeting_member_v2 (nol referensi
 * di seluruh codebase) - meeting BARU hasil booking visitor app gak
 * pernah kelihatan di exhibitor app kalau cuma andalkan meeting_member_v2.
 *
 * Fix: events_meeting_v2 sekarang punya kolom company_id (diisi
 * apivisitor saat booking) - JADI SUMBER UTAMA. meeting_member_v2 cuma
 * FALLBACK untuk data lama (booking sebelum fix ini, company_id NULL).
 *
 * Sama untuk requester visitor: meeting BARU punya initiator_id langsung
 * di events_meeting_v2 (initiated_by='VI') - JADI SUMBER UTAMA, gak perlu
 * join meeting_member_v2 lagi. Data lama tetap fallback ke
 * meeting_member_v2 VI-row.
 *
 * E2E (exhibitor vs exhibitor) TETAP full pakai meeting_member_v2 - belum
 * ada alur booking E2E baru di apivisitor sama sekali (cuma legacy).
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
    @InjectRepository(ExhibitorHaveCompany)
    private readonly haveCompanyRepo: Repository<ExhibitorHaveCompany>,
    @InjectRepository(ExhibitorContact)
    private readonly contactRepo: Repository<ExhibitorContact>,
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
  ) {}

  async list(user: CurrentExhibitor, type: MeetingTabType, status?: string) {
    const directions = type === 'visitor' ? ['E2V', 'V2E'] : ['E2E'];
    const meetings = await this.findCompanyMeetings(user, directions);
    const filtered = status ? meetings.filter((m) => m.approvalStatus === status) : meetings;
    return this.attachCounterparts(user, filtered, type);
  }

  async detail(user: CurrentExhibitor, meetingId: number) {
    const meeting = await this.meetingRepo.findOne({
      where: { eventsId: user.eventsId, id: meetingId },
    });
    if (!meeting) throw new NotFoundException('Meeting tidak ditemukan');

    const belongsToUs = await this.belongsToCompany(user, meeting);
    if (!belongsToUs) throw new NotFoundException('Meeting ini bukan untuk company kamu');

    const type: MeetingTabType = meeting.comDirection === 'E2E' ? 'exhibitor' : 'visitor';
    const [result] = await this.attachCounterparts(user, [meeting], type);
    return result;
  }

  async approve(user: CurrentExhibitor, meetingId: number, dto: ApproveMeetingDto) {
    return this.applyDecision(user, meetingId, 'APPROVE', dto.notes, dto.score);
  }

  async reject(user: CurrentExhibitor, meetingId: number, dto: RejectMeetingDto) {
    return this.applyDecision(user, meetingId, 'REJECT', dto.notes, null);
  }

  /**
   * Meeting company saya = UNION dari 2 sumber:
   * 1. company_id langsung cocok (booking baru, sumber utama)
   * 2. meeting_member_v2 EX-row punya guests_id di tim saya, DAN
   *    company_id-nya NULL (data lama/legacy - kalau company_id sudah
   *    terisi, itu bukan wilayah fallback ini lagi)
   */
  private async findCompanyMeetings(
    user: CurrentExhibitor,
    directions: string[],
  ): Promise<EventsMeetingV2[]> {
    const primaryMeetings = await this.meetingRepo.find({
      where: {
        eventsId: user.eventsId,
        companyId: user.companyId,
        comDirection: In(directions),
      },
    });

    const teamExhibitorIds = await this.getTeamExhibitorIds(user);
    let legacyMeetings: EventsMeetingV2[] = [];
    if (teamExhibitorIds.length > 0) {
      const ownRows = await this.meetingMemberRepo.find({
        where: { eventsId: user.eventsId, usertypeId: 'EX', guestsId: In(teamExhibitorIds) },
      });
      const legacyMeetingIds = [...new Set(ownRows.map((r) => r.meetingId))];
      if (legacyMeetingIds.length > 0) {
        legacyMeetings = await this.meetingRepo.find({
          where: {
            eventsId: user.eventsId,
            id: In(legacyMeetingIds),
            comDirection: In(directions),
            companyId: IsNull(), // hindari duplikat sama primaryMeetings
          },
        });
      }
    }

    const merged = [...primaryMeetings, ...legacyMeetings];
    return merged.sort((a, b) => {
      const at = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
      const bt = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
      return at - bt;
    });
  }

  private async belongsToCompany(user: CurrentExhibitor, meeting: EventsMeetingV2): Promise<boolean> {
    if (meeting.companyId != null) {
      return meeting.companyId === user.companyId;
    }
    // Fallback legacy
    const teamExhibitorIds = await this.getTeamExhibitorIds(user);
    if (teamExhibitorIds.length === 0) return false;
    const exRows = await this.meetingMemberRepo.find({
      where: { eventsId: user.eventsId, meetingId: meeting.id, usertypeId: 'EX' },
    });
    return exRows.some((r) => teamExhibitorIds.includes(r.guestsId));
  }

  private async applyDecision(
    user: CurrentExhibitor,
    meetingId: number,
    action: 'APPROVE' | 'REJECT',
    notes: string | undefined,
    score: string | null,
  ) {
    const meeting = await this.meetingRepo.findOne({
      where: { eventsId: user.eventsId, id: meetingId },
    });
    if (!meeting) throw new NotFoundException('Meeting tidak ditemukan');

    const belongsToUs = await this.belongsToCompany(user, meeting);
    if (!belongsToUs) {
      throw new BadRequestException('Meeting ini bukan untuk company kamu');
    }
    if (meeting.approvalStatus !== 'PE') {
      throw new ConflictException(
        `Meeting ini sudah diproses sebelumnya (status: ${meeting.approvalStatus})`,
      );
    }

    const approvalStatus = action === 'APPROVE' ? 'AP' : 'CL';
    const status = action === 'APPROVE' ? 'OPEN' : 'CANCEL';

    meeting.approvalStatus = approvalStatus;
    meeting.status = status;
    if (score) meeting.meetingScore = score;
    await this.meetingRepo.save(meeting);

    await this.meetingActionRepo.save(
      this.meetingActionRepo.create({
        eventsId: user.eventsId,
        meetingId,
        action,
        actorExhibitorId: user.exhibitorId,
        notes: notes ?? null,
        score,
        createdAt: new Date(),
      }),
    );

    return { meetingId, approvalStatus, status, score: meeting.meetingScore };
  }

  private async getTeamExhibitorIds(user: CurrentExhibitor): Promise<number[]> {
    const links = await this.haveCompanyRepo.find({
      where: { eventsId: user.eventsId, companyId: user.companyId },
    });
    return links.map((l) => l.exhibitorId);
  }

  private async attachCounterparts(
    user: CurrentExhibitor,
    meetings: EventsMeetingV2[],
    type: MeetingTabType,
  ) {
    if (meetings.length === 0) return [];
    const meetingIds = meetings.map((m) => m.id);

    if (type === 'visitor') {
      // PRIMARY: initiator_id langsung di meeting (booking baru)
      const meetingsWithInitiator = meetings.filter(
        (m) => m.initiatedBy === 'VI' && m.initiatorId != null,
      );
      // FALLBACK: meeting_member_v2 VI-row (data lama)
      const meetingsNeedingFallback = meetings.filter(
        (m) => !(m.initiatedBy === 'VI' && m.initiatorId != null),
      );

      const fallbackViRows = meetingsNeedingFallback.length
        ? await this.meetingMemberRepo
            .createQueryBuilder('mm')
            .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('mm.meetingId IN (:...ids)', {
              ids: meetingsNeedingFallback.map((m) => m.id),
            })
            .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'VI' })
            .getMany()
        : [];

      const allGuestIds = [
        ...new Set([
          ...meetingsWithInitiator.map((m) => m.initiatorId as number),
          ...fallbackViRows.map((r) => r.guestsId),
        ]),
      ];
      const guests = allGuestIds.length
        ? await this.guestsRepo
            .createQueryBuilder('g')
            .where('g.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('g.guestsId IN (:...ids)', { ids: allGuestIds })
            .getMany()
        : [];

      return meetings.map((m) => {
        const guestsId =
          m.initiatedBy === 'VI' && m.initiatorId != null
            ? m.initiatorId
            : fallbackViRows.find((r) => r.meetingId === m.id)?.guestsId ?? null;
        const guest = guestsId != null ? guests.find((g) => g.guestsId === guestsId) : null;
        return this.toMeetingSummary(m, {
          type: 'visitor',
          guestsId,
          fullname: guest?.fullname ?? null,
          companyName: null,
        });
      });
    }

    // type === 'exhibitor' (E2E) - tetap full pakai meeting_member_v2,
    // belum ada alur booking E2E baru.
    const teamExhibitorIds = await this.getTeamExhibitorIds(user);
    const otherExRows = await this.meetingMemberRepo
      .createQueryBuilder('mm')
      .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('mm.meetingId IN (:...ids)', { ids: meetingIds })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .andWhere(
        teamExhibitorIds.length > 0 ? 'mm.guestsId NOT IN (:...teamIds)' : '1=1',
        teamExhibitorIds.length > 0 ? { teamIds: teamExhibitorIds } : {},
      )
      .getMany();

    const otherExhibitorIds = [...new Set(otherExRows.map((r) => r.guestsId))];
    const [otherContacts, otherHaveCompany] = await Promise.all([
      otherExhibitorIds.length
        ? this.contactRepo
            .createQueryBuilder('c')
            .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('c.id IN (:...ids)', { ids: otherExhibitorIds })
            .getMany()
        : Promise.resolve([]),
      otherExhibitorIds.length
        ? this.haveCompanyRepo
            .createQueryBuilder('h')
            .where('h.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('h.exhibitorId IN (:...ids)', { ids: otherExhibitorIds })
            .getMany()
        : Promise.resolve([]),
    ]);

    const otherCompanyIds = [...new Set(otherHaveCompany.map((h) => h.companyId))];
    const otherCompanies = otherCompanyIds.length
      ? await this.companyRepo
          .createQueryBuilder('c')
          .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
          .andWhere('c.id IN (:...ids)', { ids: otherCompanyIds })
          .getMany()
      : [];

    return meetings.map((m) => {
      const otherRow = otherExRows.find((r) => r.meetingId === m.id);
      const contact = otherRow ? otherContacts.find((c) => c.id === otherRow.guestsId) : null;
      const link = otherRow
        ? otherHaveCompany.find((h) => h.exhibitorId === otherRow.guestsId)
        : null;
      const company = link ? otherCompanies.find((c) => c.id === link.companyId) : null;

      return this.toMeetingSummary(m, {
        type: 'exhibitor',
        guestsId: otherRow?.guestsId ?? null,
        fullname: contact?.fullname ?? null,
        companyName: company?.companyName ?? null,
      });
    });
  }

  private toMeetingSummary(
    m: EventsMeetingV2,
    counterpart: {
      type: MeetingTabType;
      guestsId: number | null;
      fullname: string | null;
      companyName: string | null;
    },
  ) {
    return {
      meetingId: m.id,
      meetingTitle: m.meetingTitle,
      startDatetime: m.startDatetime,
      endDatetime: m.endDatetime,
      approvalStatus: m.approvalStatus,
      status: m.status,
      temperature: m.meetingScore,
      comDirection: m.comDirection,
      counterpart,
    };
  }
}
