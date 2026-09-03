import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { BoothService } from '../booth/booth.service';
import { MeetingsService } from '../meetings/meetings.service';
import { LinkClickLog } from './entities/link-click-log.entity';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

/**
 * Laporan = kombinasi lead + meeting dalam rentang tanggal, plus export
 * XLSX lead. SENGAJA reuse BoothService.listLeads() & MeetingsService.list()
 * yang sudah ada (bukan query ulang dari nol) - satu sumber kebenaran
 * buat "temperature" dan "company ownership", gak ada resiko dua logic
 * beda tempat jadi gak sinkron.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly boothService: BoothService,
    private readonly meetingsService: MeetingsService,
    @InjectRepository(LinkClickLog)
    private readonly linkClickLogRepo: Repository<LinkClickLog>,
  ) {}

  async getSummary(user: CurrentExhibitor, from?: string, to?: string) {
    const { start, end } = this.resolveRange(from, to);

    const [leadsResult, visitorMeetings, exhibitorMeetings, clicks] = await Promise.all([
      this.boothService.listLeads(user),
      this.meetingsService.list(user, 'visitor'),
      this.meetingsService.list(user, 'exhibitor'),
      this.linkClickLogRepo
        .createQueryBuilder('c')
        .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
        .andWhere('c.companyId = :companyId', { companyId: user.companyId })
        .andWhere('c.clickedAt >= :start AND c.clickedAt <= :end', { start, end })
        .getMany(),
    ]);

    // Cuma hitung yang sudah confirmed (bukan pending) & masuk rentang
    // tanggal - laporan harus reflect data settled, bukan yang masih
    // nunggu round-trip push-job.
    const leadsInRange = leadsResult.leads.filter(
      (l) => !l.pending && l.createdAt && this.inRange(new Date(l.createdAt), start, end),
    );

    const leadSummary = {
      total: leadsInRange.length,
      bySource: {
        scan: leadsInRange.filter((l) => l.source === 'SCAN').length,
        eventGuest: leadsInRange.filter((l) => l.source === 'EVENT_GUEST').length,
        manual: leadsInRange.filter((l) => l.source === 'MANUAL').length,
      },
      byTemperature: {
        hot: leadsInRange.filter((l) => l.temperature === 'Hot').length,
        warm: leadsInRange.filter((l) => l.temperature === 'Warm').length,
        cold: leadsInRange.filter((l) => l.temperature === 'Cold').length,
        none: leadsInRange.filter((l) => !l.temperature).length,
      },
    };

    const allMeetings = [...visitorMeetings, ...exhibitorMeetings].filter(
      (m) => m.startDatetime && this.inRange(new Date(m.startDatetime), start, end),
    );
    const meetingSummary = {
      total: allMeetings.length,
      approved: allMeetings.filter((m) => m.approvalStatus === 'AP').length,
      pending: allMeetings.filter((m) => m.approvalStatus === 'PE').length,
      rejected: allMeetings.filter((m) => m.approvalStatus === 'CL').length,
      withVisitor: allMeetings.filter((m) => m.comDirection !== 'E2E').length,
      withExhibitor: allMeetings.filter((m) => m.comDirection === 'E2E').length,
    };

    const clickSummary = {
      total: clicks.length,
      byType: {
        instagram: clicks.filter((c) => c.linkType === 'INSTAGRAM').length,
        facebook: clicks.filter((c) => c.linkType === 'FACEBOOK').length,
        tiktok: clicks.filter((c) => c.linkType === 'TIKTOK').length,
        twitter: clicks.filter((c) => c.linkType === 'TWITTER').length,
        website: clicks.filter((c) => c.linkType === 'WEBSITE').length,
        brochure: clicks.filter((c) => c.linkType === 'BROCHURE').length,
        promo: clicks.filter((c) => c.linkType === 'PROMO').length,
      },
    };

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      leads: leadSummary,
      meetings: meetingSummary,
      clicks: clickSummary,
    };
  }

  async exportLeadsXlsx(user: CurrentExhibitor, from?: string, to?: string): Promise<Buffer> {
    const { start, end } = this.resolveRange(from, to);
    const { leads } = await this.boothService.listLeads(user);
    const leadsInRange = leads.filter(
      (l) => !l.pending && l.createdAt && this.inRange(new Date(l.createdAt), start, end),
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');
    sheet.columns = [
      { header: 'Nama', key: 'fullname', width: 30 },
      { header: 'Sumber', key: 'source', width: 15 },
      { header: 'Temperature', key: 'temperature', width: 12 },
      { header: 'Waktu', key: 'createdAt', width: 22 },
      { header: 'Telepon', key: 'phone', width: 18 },
      { header: 'Company', key: 'company', width: 25 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const lead of leadsInRange) {
      sheet.addRow({
        fullname: lead.fullname ?? '-',
        source: lead.source,
        temperature: lead.temperature ?? '-',
        createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : '-',
        phone: lead.manualPhone ?? '-',
        company: lead.manualCompany ?? '-',
        notes: lead.notes ?? '-',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private resolveRange(from?: string, to?: string): { start: Date; end: Date } {
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  private inRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }
}
