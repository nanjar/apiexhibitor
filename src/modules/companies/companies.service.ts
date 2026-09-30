import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { BoothResolverService } from '../venue/booth-resolver.service';
import { CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';

/**
 * Companies = directory company exhibitor LAIN di event ini (bukan
 * company sendiri) - buat exhibitor cari calon business matching partner.
 * Cuma company approved (approval_status='AP') yang ditampilkan.
 */
@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
    private readonly boothResolver: BoothResolverService,
  ) {}

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

    const boothMap = await this.boothResolver.resolveMany(
      user.eventsId,
      companies.map((c) => c.id),
    );

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

    const booth = await this.boothResolver.resolveOne(user.eventsId, company.id);

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
      isOwnCompany: company.id === user.companyId,
    };
  }
}
