import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhibitorContact } from '../exhibitors/entities/exhibitor-contact.entity';
import { BoothResolverService } from '../venue/booth-resolver.service';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';

/**
 * Companies = directory company exhibitor LAIN di event ini (bukan
 * company sendiri) - buat exhibitor cari calon business matching partner.
 * Cuma company approved (approval_status='AP') yang ditampilkan.
 *
 * Tiap company ikut nampilin PIC-nya (exhibitor_contact user_level='ADM')
 * - satu company secara teknis bisa punya >1 ADM, jadi diambil semua.
 */
@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
    @InjectRepository(ExhibitorContact)
    private readonly contactRepo: Repository<ExhibitorContact>,
    private readonly boothResolver: BoothResolverService,
  ) {}

  // Batch-friendly: ambil semua PIC (user_level='ADM') buat sekumpulan
  // company sekaligus, hindari N+1.
  private async getAdminsByCompany(
    eventsId: number,
    companyIds: number[],
  ): Promise<Map<number, { id: number; fullname: string | null; jobTitle: string | null; phone: string | null; email: string | null }[]>> {
    const map = new Map<
      number,
      { id: number; fullname: string | null; jobTitle: string | null; phone: string | null; email: string | null }[]
    >();
    if (!companyIds.length) return map;

    const admins = await this.contactRepo.find({
      where: { eventsId, companyId: In(companyIds), userLevel: 'ADM' },
    });
    for (const admin of admins) {
      if (admin.companyId == null) continue;
      const list = map.get(admin.companyId) ?? [];
      list.push({
        id: admin.id,
        fullname: admin.fullname,
        jobTitle: admin.jobTitle,
        phone: admin.phone,
        email: admin.exhibitorEmail,
      });
      map.set(admin.companyId, list);
    }
    return map;
  }

  async list(user: CurrentExhibitor, query: ListCompaniesQueryDto) {
    const qb = this.companyRepo
      .createQueryBuilder('c')
      .where('c.eventsId = :eventsId', { eventsId: user.eventsId })
      .andWhere('c.approvalStatus = :status', { status: 'AP' })
      .andWhere('c.id != :ownCompanyId', { ownCompanyId: user.companyId });

    if (query.search) {
      qb.andWhere('c.companyName ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.country) {
      qb.andWhere('c.country = :country', { country: query.country });
    }

    const [companies, total] = await qb
      .orderBy('c.companyName', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const companyIds = companies.map((c) => c.id);
    const [boothMap, adminMap] = await Promise.all([
      this.boothResolver.resolveMany(user.eventsId, companyIds),
      this.getAdminsByCompany(user.eventsId, companyIds),
    ]);

    return {
      page: query.page,
      limit: query.limit,
      total,
      items: companies.map((c) => {
        const booth = boothMap.get(c.id);
        return {
          id: c.id,
          companyName: c.companyName,
          logo: c.logo,
          details: c.details,
          country: c.country,
          companyWebsite: c.companyWebsite,
          companyProfileUrl: c.companyProfileUrl,
          venueName: booth?.venueName ?? null,
          hallLabel: booth?.hallLabel ?? null,
          boothLabel: booth?.boothLabel ?? null,
          admins: adminMap.get(c.id) ?? [],
        };
      }),
    };
  }

  async getDetail(user: CurrentExhibitor, companyId: number) {
    const company = await this.companyRepo.findOne({
      where: { eventsId: user.eventsId, id: companyId, approvalStatus: 'AP' },
    });
    if (!company) {
      throw new NotFoundException('Company tidak ditemukan');
    }

    const [booth, adminMap] = await Promise.all([
      this.boothResolver.resolveOne(user.eventsId, company.id),
      this.getAdminsByCompany(user.eventsId, [company.id]),
    ]);

    return {
      id: company.id,
      companyName: company.companyName,
      logo: company.logo,
      details: company.details,
      country: company.country,
      companyWebsite: company.companyWebsite,
      companyProfileUrl: company.companyProfileUrl,
      venueName: booth.venueName,
      hallLabel: booth.hallLabel,
      boothLabel: booth.boothLabel,
      admins: adminMap.get(company.id) ?? [],
      isOwnCompany: company.id === user.companyId,
    };
  }
}
