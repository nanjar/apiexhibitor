import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
 * KOREKSI PENTING (Sept 2026): meeting_member_v2.company_id TIDAK BOLEH
 * dipakai untuk cari "meeting ini punya company siapa" - datanya tidak
 * reliable. Cara yang benar:
 *
 * 1. Ambil exhibitor_id tim company ini dari exhibitor_have_company.
 * 2. Cari baris meeting_member_v2 usertype_id='EX' DENGAN guests_id ada
 *    di daftar exhibitor_id tim tadi - guests_id pada baris EX itu
 *    exhibitor_contact.id (BUKAN referensi guests_ticket), beda makna
 *    dari baris usertype_id='VI' yang guests_id-nya betulan guests_ticket.
 *
 * Meeting bisa dua jenis (com_direction di events_meeting_v2):
 * - E2V/V2E = Exhibitor vs Visitor -> lawan bicara dicari dari baris VI
 * - E2E = Exhibitor vs Exhibitor lain -> lawan bicara dicari dari baris
 *   EX LAIN (guests_id di luar daftar tim kita), company-nya di-resolve
 *   lewat exhibitor_have_company punya exhibitor itu, BUKAN kolom
 *   company_id di meeting_member_v2.
 *
 * UI: 2 tab terpisah (Meeting dgn Visitor vs Meeting dgn Exhibitor lain).
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
    const teamExhibitorIds = await this.getTeamExhibitorIds(user);
    if (teamExhibitorIds.length === 0) return [];

    const directions = type === 'visitor' ? ['E2V', 'V2E'] : ['E2E'];

    const ownRows = await this.meetingMemberRepo
      .createQueryBuilder('mm')
      .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'EX' })
      .andWhere('mm.guestsId IN (:...ids)', { ids: teamExhibitorIds })
      .getMany();

    if (ownRows.length === 0) return [];
    const meetingIds = [...new Set(ownRows.map((r) => r.meetingId))];

    const meetings = await this.meetingRepo
      .createQueryBuilder('m')
      .where('m.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('m.id IN (:...ids)', { ids: meetingIds })
      .andWhere('m.comDirection IN (:...directions)', { directions })
      .orderBy('m.startDatetime', 'ASC')
      .getMany();

    const filtered = status ? meetings.filter((m) => m.approvalStatus === status) : meetings;
    return this.attachCounterparts(user, filtered, type, teamExhibitorIds);
  }

  async detail(user: CurrentExhibitor, meetingId: number) {
    const teamExhibitorIds = await this.getTeamExhibitorIds(user);
    const allExRows = await this.meetingMemberRepo.find({
      where: { eventsId: user.eventsId, meetingId, usertypeId: 'EX' },
    });
    const belongsToUs = allExRows.some((r) => teamExhibitorIds.includes(r.guestsId));
    if (!belongsToUs) throw new NotFoundException('Meeting ini bukan untuk company kamu');

    const meeting = await this.meetingRepo.findOne({
      where: { eventsId: user.eventsId, id: meetingId },
    });
    if (!meeting) throw new NotFoundException('Meeting tidak ditemukan');

    const type: MeetingTabType = meeting.comDirection === 'E2E' ? 'exhibitor' : 'visitor';
    const [result] = await this.attachCounterparts(user, [meeting], type, teamExhibitorIds);
    return result;
  }

  async approve(user: CurrentExhibitor, meetingId: number, dto: ApproveMeetingDto) {
    return this.applyDecision(user, meetingId, 'APPROVE', dto.notes, dto.score);
  }

  async reject(user: CurrentExhibitor, meetingId: number, dto: RejectMeetingDto) {
    return this.applyDecision(user, meetingId, 'REJECT', dto.notes, null);
  }

  private async applyDecision(
    user: CurrentExhibitor,
    meetingId: number,
    action: 'APPROVE' | 'REJECT',
    notes: string | undefined,
    score: string | null,
  ) {
    const teamExhibitorIds = await this.getTeamExhibitorIds(user);
    const exRows = await this.meetingMemberRepo.find({
      where: { eventsId: user.eventsId, meetingId, usertypeId: 'EX' },
    });
    const belongsToUs = exRows.some((r) => teamExhibitorIds.includes(r.guestsId));
    if (!belongsToUs) {
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
    teamExhibitorIds: number[],
  ) {
    if (meetings.length === 0) return [];
    const meetingIds = meetings.map((m) => m.id);

    if (type === 'visitor') {
      const viRows = await this.meetingMemberRepo
        .createQueryBuilder('mm')
        .where('mm.eventsId = :eventsId', { eventsId: user.eventsId })
        .andWhere('mm.meetingId IN (:...ids)', { ids: meetingIds })
        .andWhere('mm.usertypeId = :usertypeId', { usertypeId: 'VI' })
        .getMany();

      const guestIds = [...new Set(viRows.map((r) => r.guestsId))];
      const guests = guestIds.length
        ? await this.guestsRepo
            .createQueryBuilder('g')
            .where('g.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('g.guestsId IN (:...ids)', { ids: guestIds })
            .getMany()
        : [];

      return meetings.map((m) => {
        const viRow = viRows.find((r) => r.meetingId === m.id);
        const guest = viRow ? guests.find((g) => g.guestsId === viRow.guestsId) : null;
        return this.toMeetingSummary(m, {
          type: 'visitor',
          guestsId: viRow?.guestsId ?? null,
          fullname: guest?.fullname ?? null,
          companyName: null,
        });
      });
    }

    // type === 'exhibitor': lawan bicara = baris EX LAIN (guests_id di
    // luar tim kita) untuk meeting_id yang sama.
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
      // Satu exhibitor bisa terhubung ke >1 company (exhibitor_have_company) -
      // ambil yang pertama, edge case multi-company E2E belum ditangani presisi.
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
