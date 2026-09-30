import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorLeadSync } from '../booth/entities/exhibitor-lead-sync.entity';
import { ExhibitorLeadAction } from '../booth/entities/exhibitor-lead-action.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Visitor List = directory/browse visitor yang SUDAH TERDAFTAR di
 * bizmatch app (EXISTS di bizmatch_guestsv2), BUKAN semua pemegang tiket
 * event (guests_ticket) dan BUKAN cuma yang sudah jadi lead booth ini.
 * Dipakai exhibitor buat cari calon lead sebelum scan.
 *
 * bizmatch_guestsv2 bisa punya beberapa baris per guest (per
 * member_guests_id - akun rombongan), jadi dedup pakai EXISTS subquery,
 * bukan JOIN, supaya guests_ticket tidak ke-duplikasi di hasil. apps_type
 * ('apps'/'web') murni info asal join, tidak dipakai sebagai filter.
 *
 * "alreadyLead" dihitung dengan scoping SAMA PERSIS seperti
 * BoothService.listLeads() (eventsId+companyId+venueId+spaceId), gabungan
 * confirmed (exhibitor_lead_sync) + pending (exhibitor_app_lead_action,
 * action='CREATE') - supaya konsisten dengan apa yang kelihatan di My
 * Booth.
 */
@Injectable()
export class VisitorsService {
  constructor(
    @InjectRepository(GuestsTicket)
    private readonly guestsRepo: Repository<GuestsTicket>,
    @InjectRepository(ExhibitorLeadSync)
    private readonly leadSyncRepo: Repository<ExhibitorLeadSync>,
    @InjectRepository(ExhibitorLeadAction)
    private readonly leadActionRepo: Repository<ExhibitorLeadAction>,
  ) {}

  async list(user: CurrentExhibitor, search?: string, page?: string, limit?: string) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    );

    const qb = this.guestsRepo
      .createQueryBuilder('g')
      .where('g.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM bizmatch_guestsv2 b
          WHERE b.events_id = g.events_id AND b.guests_id = g.guests_id
        )`,
      );

    if (search) {
      qb.andWhere('(g.fullname ILIKE :search OR g.companyName ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [visitors, total] = await qb
      .orderBy('g.fullname', 'ASC')
      .skip((pageNum - 1) * limitNum)
      .take(limitNum)
      .getManyAndCount();

    const leadGuestIds = await this.alreadyLeadGuestIds(user);

    return {
      page: pageNum,
      limit: limitNum,
      total,
      items: visitors.map((v) => ({
        guestsId: v.guestsId,
        fullname: v.fullname,
        guestTitle: v.guestTitle,
        email: v.email,
        phone: v.phone,
        companyName: v.companyName,
        alreadyLead: leadGuestIds.has(v.guestsId),
      })),
    };
  }

  // Set guestsId yang sudah pernah di-add jadi lead booth ini (confirmed +
  // pending), scoped ke company/venue/space exhibitor yang login.
  private async alreadyLeadGuestIds(user: CurrentExhibitor): Promise<Set<number>> {
    const scope = {
      eventsId: user.eventsId,
      companyId: user.companyId,
      venueId: user.venueId,
      spaceId: user.spaceId,
    };
    const [confirmed, pending] = await Promise.all([
      this.leadSyncRepo.find({ where: scope, select: ['guestsId'] }),
      this.leadActionRepo.find({
        where: { ...scope, action: 'CREATE' },
        select: ['guestsId'],
      }),
    ]);
    const ids = new Set<number>();
    for (const row of [...confirmed, ...pending]) {
      if (row.guestsId != null) ids.add(row.guestsId);
    }
    return ids;
  }
}
