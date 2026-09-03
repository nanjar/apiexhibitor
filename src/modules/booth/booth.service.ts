import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorLeadSync } from './entities/exhibitor-lead-sync.entity';
import { ExhibitorLeadAction } from './entities/exhibitor-lead-action.entity';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { MeetingMemberV2 } from '../meetings/entities/meeting-member-v2.entity';
import { EventsMeetingV2 } from '../meetings/entities/events-meeting-v2.entity';
import { ExhibitorHaveCompany } from '../exhibitors/entities/exhibitor-have-company.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { ScanLeadDto } from './dto/scan-lead.dto';
import { ManualLeadDto } from './dto/manual-lead.dto';

const SCORE_PRIORITY: Record<string, number> = { Hot: 3, Warm: 2, Cold: 1 };

/**
 * My Booth = lead management. Scan/tambah manual TIDAK ditulis langsung
 * ke mirror (exhibitor_lead_sync) - beda dari meeting/member - karena id
 * di sana AUTO_INCREMENT MySQL, belum tahu nilainya sebelum push-job jalan.
 * Solusinya: list gabungkan mirror (sudah confirmed) + staging yang belum
 * ke-push (pending: true), supaya tetap langsung kelihatan di UI tanpa
 * nunggu round-trip push-job.
 *
 * Temperature = meeting_score dari meeting APPROVED dengan skor TERTINGGI
 * (Hot > Warm > Cold) antara visitor itu & company - dihitung dari
 * meeting_member_v2 + events_meeting_v2 (bukan field tersendiri).
 */
@Injectable()
export class BoothService {
  constructor(
    @InjectRepository(ExhibitorLeadSync)
    private readonly leadSyncRepo: Repository<ExhibitorLeadSync>,
    @InjectRepository(ExhibitorLeadAction)
    private readonly leadActionRepo: Repository<ExhibitorLeadAction>,
    @InjectRepository(GuestsTicket)
    private readonly guestsRepo: Repository<GuestsTicket>,
    @InjectRepository(MeetingMemberV2)
    private readonly meetingMemberRepo: Repository<MeetingMemberV2>,
    @InjectRepository(ExhibitorHaveCompany)
    private readonly haveCompanyRepo: Repository<ExhibitorHaveCompany>,
  ) {}

  async scan(user: CurrentExhibitor, dto: ScanLeadDto) {
    const action = this.leadActionRepo.create({
      eventsId: user.eventsId,
      companyId: user.companyId,
      venueId: user.venueId,
      spaceId: user.spaceId,
      actorExhibitorId: user.exhibitorId,
      guestsId: dto.guestsId,
      source: dto.source,
      notes: dto.notes ?? null,
      createdAt: new Date(),
    });
    await this.leadActionRepo.save(action);
    return { pending: true, actionId: action.id, source: dto.source };
  }

  async addManual(user: CurrentExhibitor, dto: ManualLeadDto) {
    const action = this.leadActionRepo.create({
      eventsId: user.eventsId,
      companyId: user.companyId,
      venueId: user.venueId,
      spaceId: user.spaceId,
      actorExhibitorId: user.exhibitorId,
      guestsId: null,
      source: 'MANUAL',
      manualFullname: dto.fullname,
      manualPhone: dto.phone ?? null,
      manualCompany: dto.company ?? null,
      notes: dto.notes ?? null,
      createdAt: new Date(),
    });
    await this.leadActionRepo.save(action);
    return { pending: true, actionId: action.id, source: 'MANUAL' };
  }

  async listLeads(
    user: CurrentExhibitor,
    temperature?: 'Hot' | 'Warm' | 'Cold',
    todayOnly = false,
  ) {
    const [confirmed, pending] = await Promise.all([
      this.leadSyncRepo.find({
        where: {
          eventsId: user.eventsId,
          companyId: user.companyId,
          venueId: user.venueId,
          spaceId: user.spaceId,
        },
        order: { createdAt: 'DESC' },
      }),
      this.leadActionRepo.find({
        where: {
          eventsId: user.eventsId,
          companyId: user.companyId,
          venueId: user.venueId,
          spaceId: user.spaceId,
        },
      }),
    ]);

    // FIX (Sept 2026): sebelumnya pakai pushedAt===null untuk nentuin
    // "pending" - ternyata ada CELAH: begitu push-job selesai (pushedAt
    // terisi) tapi pull-sync BELUM jalan lagi, row itu jadi tidak masuk
    // kategori manapun (bukan pending karena pushedAt sudah ada, bukan
    // confirmed karena belum ada di mirror) - "hilang sementara" dari UI.
    //
    // Fix: staging row dianggap "masih pending" kalau BELUM ADA row
    // confirmed yang cocok (bukan berdasar pushedAt). Dicocokkan lewat
    // createdAt PERSIS SAMA (push-job selalu insert created_at staging
    // apa adanya ke MySQL) + identitas lain - key yang reliable karena
    // timestamp staging tidak pernah diubah push-job.
    const confirmedKeys = new Set(
      confirmed.map((c) =>
        this.correlationKey(c.eventsId, c.companyId, c.venueId, c.spaceId, c.exhibitorId, c.createdAt),
      ),
    );
    const pendingOnly = pending.filter(
      (p) =>
        !confirmedKeys.has(
          this.correlationKey(
            p.eventsId,
            p.companyId,
            p.venueId,
            p.spaceId,
            p.actorExhibitorId,
            p.createdAt,
          ),
        ),
    );

    let items = [
      ...confirmed.map((c) => this.toLeadItem(c, false)),
      ...pendingOnly.map((p) => this.toLeadItem(p, true)),
    ];

    if (todayOnly) {
      const startOfDay = this.jakartaStartOfDay();
      items = items.filter((i) => i.createdAt && new Date(i.createdAt) >= startOfDay);
    }

    // Source breakdown - dihitung dari SEMUA lead (bukan cuma yang lolos
    // filter today/temperature), sesuai mockup ("11 Dari scan" itu total).
    const sourceCounts = {
      scan: items.filter((i) => i.source === 'SCAN').length,
      eventGuest: items.filter((i) => i.source === 'EVENT_GUEST').length,
      manual: items.filter((i) => i.source === 'MANUAL').length,
    };

    // Temperature - cuma untuk item yang punya guestsId (SCAN/EVENT_GUEST).
    const guestIds = [...new Set(items.filter((i) => i.guestsId).map((i) => i.guestsId as number))];
    const [guests, temperatureMap] = await Promise.all([
      guestIds.length
        ? this.guestsRepo
            .createQueryBuilder('g')
            .where('g.eventsId = :eventsId', { eventsId: user.eventsId })
            .andWhere('g.guestsId IN (:...ids)', { ids: guestIds })
            .getMany()
        : Promise.resolve([]),
      guestIds.length
        ? this.getTemperatures(user, guestIds)
        : Promise.resolve(new Map<number, string | null>()),
    ]);

    let result = items.map((i) => {
      const guest = i.guestsId ? guests.find((g) => g.guestsId === i.guestsId) : null;
      return {
        ...i,
        fullname: i.guestsId ? guest?.fullname ?? null : i.manualFullname,
        temperature: i.guestsId ? temperatureMap.get(i.guestsId) ?? null : null,
      };
    });

    if (temperature) {
      result = result.filter((i) => i.temperature === temperature);
    }

    return { sourceCounts, leads: result };
  }

  private toLeadItem(row: ExhibitorLeadSync | ExhibitorLeadAction, pending: boolean) {
    return {
      id: pending ? null : (row as ExhibitorLeadSync).id,
      pending,
      guestsId: row.guestsId,
      source: row.source,
      manualFullname: row.manualFullname,
      manualPhone: row.manualPhone,
      manualCompany: row.manualCompany,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }

  private async getTemperatures(
    user: CurrentExhibitor,
    guestIds: number[],
  ): Promise<Map<number, string | null>> {
    const teamLinks = await this.haveCompanyRepo.find({
      where: { eventsId: user.eventsId, companyId: user.companyId },
    });
    const teamExhibitorIds = teamLinks.map((l) => l.exhibitorId);
    if (teamExhibitorIds.length === 0) return new Map();

    const rows = await this.meetingMemberRepo
      .createQueryBuilder('vi')
      .innerJoin(
        MeetingMemberV2,
        'ex',
        'ex.eventsId = vi.eventsId AND ex.meetingId = vi.meetingId AND ex.usertypeId = :exType',
        { exType: 'EX' },
      )
      .innerJoin(EventsMeetingV2, 'm', 'm.eventsId = vi.eventsId AND m.id = vi.meetingId')
      .select(['vi.guestsId AS guests_id', 'm.meetingScore AS meeting_score'])
      .where('vi.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('vi.usertypeId = :viType', { viType: 'VI' })
      .andWhere('vi.guestsId IN (:...guestIds)', { guestIds })
      .andWhere('ex.guestsId IN (:...teamIds)', { teamIds: teamExhibitorIds })
      .andWhere('m.approvalStatus = :status', { status: 'AP' })
      .getRawMany<{ guests_id: number; meeting_score: string | null }>();

    const map = new Map<number, string | null>();
    for (const r of rows) {
      if (!r.meeting_score) continue;
      const current = map.get(r.guests_id);
      const currentPriority = current ? SCORE_PRIORITY[current] ?? 0 : 0;
      const newPriority = SCORE_PRIORITY[r.meeting_score] ?? 0;
      if (newPriority > currentPriority) {
        map.set(r.guests_id, r.meeting_score);
      }
    }
    return map;
  }

  private correlationKey(
    eventsId: number,
    companyId: number,
    venueId: number,
    spaceId: number,
    exhibitorId: number,
    createdAt: Date,
  ): string {
    // Truncate ke presisi DETIK - MySQL `datetime` tidak simpan milidetik,
    // jadi row yang sudah pulang-pergi lewat MySQL bakal beda milidetik-nya
    // dari staging asli kalau dibandingkan penuh.
    const seconds = Math.floor(new Date(createdAt).getTime() / 1000);
    return `${eventsId}|${companyId}|${venueId}|${spaceId}|${exhibitorId}|${seconds}`;
  }

  private jakartaStartOfDay(): Date {
    const nowUtc = new Date();
    const jakartaOffsetMs = 7 * 60 * 60 * 1000;
    const jakartaNow = new Date(nowUtc.getTime() + jakartaOffsetMs);
    jakartaNow.setUTCHours(0, 0, 0, 0);
    return new Date(jakartaNow.getTime() - jakartaOffsetMs);
  }
}
