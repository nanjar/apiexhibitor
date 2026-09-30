import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { GuestsTicket } from '../guests/entities/guests-ticket.entity';
import { ExhibitorLeadSync } from '../booth/entities/exhibitor-lead-sync.entity';
import { ExhibitorLeadAction } from '../booth/entities/exhibitor-lead-action.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Visitor List = directory/browse SEMUA visitor terdaftar di event ini
 * (guests_ticket), BUKAN cuma yang sudah jadi lead booth ini. Dipakai
 * exhibitor buat cari calon lead sebelum scan.
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

    const where = search
      ? [
          { eventsId: user.eventsId, fullname: ILike(`%${search}%`) },
          { eventsId: user.eventsId, companyName: ILike(`%${search}%`) },
        ]
      : { eventsId: user.eventsId };

    const [visitors, total] = await this.guestsRepo.findAndCount({
      where,
      order: { fullname: 'ASC' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

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
