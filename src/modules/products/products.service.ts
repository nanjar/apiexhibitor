import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExhibitorProduct } from '../reports/entities/exhibitor-product.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ExhibitorProductHasType } from '../product-types/entities/exhibitor-product-has-type.entity';
import { ProductTypeResolverService } from '../product-types/product-type-resolver.service';
import { ProductSearchQueryDto } from './dto/product-search-query.dto';

/**
 * Products = pencarian & detail produk LINTAS COMPANY dalam 1 event -
 * port dari ProductsService apivisitor, dikurangi konsep favorite (itu
 * fitur visitor, gak ada di exhibitor app).
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ExhibitorProduct)
    private readonly productRepo: Repository<ExhibitorProduct>,
    @InjectRepository(ExhibitorCompany)
    private readonly companyRepo: Repository<ExhibitorCompany>,
    private readonly productTypeResolver: ProductTypeResolverService,
  ) {}

  async search(eventsId: number, query: ProductSearchQueryDto) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.eventsId = :eventsId', { eventsId })
      .andWhere('p.approvalStatus = :status', { status: 'AP' });

    if (query.keyword) {
      qb.andWhere('(p.productName ILIKE :kw OR p.productDescription ILIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }
    // JOIN langsung ke pivot table (bukan fetch-id-dulu) - WAJIB match
    // events_id + company_id + product_id sekaligus karena product_id
    // gak unik lintas company.
    if (query.productTypeId?.length) {
      qb.innerJoin(
        ExhibitorProductHasType,
        'pivot',
        'pivot.eventsId = p.eventsId AND pivot.companyId = p.companyId AND pivot.productId = p.id AND pivot.productTypeId IN (:...typeIds)',
        { typeIds: query.productTypeId },
      ).distinct(true);
    }

    const [items, total] = await qb
      .orderBy('p.created', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const companyIds = [...new Set(items.map((p) => p.companyId))];
    const companies = companyIds.length
      ? await this.companyRepo.find({ where: { eventsId } })
      : [];
    const companyMap = new Map(companies.map((c) => [c.id, c.companyName]));

    const productTypeMap = await this.productTypeResolver.resolveForProducts(
      eventsId,
      items.map((p) => ({ companyId: p.companyId, productId: p.id })),
    );

    return {
      items: items.map((p) => ({
        id: p.id,
        companyId: p.companyId,
        companyName: companyMap.get(p.companyId) ?? null,
        productName: p.productName,
        productLogo: p.productLogo,
        investmentFee: p.investmentFee,
        productTypes: productTypeMap.get(`${p.companyId}-${p.id}`) ?? [],
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  // Filter chip "All (24) | Automation | IoT | AI | Sensor" di Product Catalog
  async listProductTypes(eventsId: number) {
    return this.productTypeResolver.listWithProductCount(eventsId);
  }

  async getDetail(eventsId: number, companyId: number, productId: number) {
    const product = await this.productRepo.findOne({
      where: { eventsId, companyId, id: productId },
    });
    if (!product) {
      throw new NotFoundException('Produk tidak ditemukan');
    }

    const productTypeMap = await this.productTypeResolver.resolveForProducts(eventsId, [
      { companyId, productId },
    ]);

    return {
      id: product.id,
      companyId: product.companyId,
      productName: product.productName,
      productLogo: product.productLogo,
      productDescription: product.productDescription,
      investmentFee: product.investmentFee,
      brochure: product.brochure,
      websiteUrl: product.websiteUrl,
      promoUrl: product.promoUrl,
      instagram: product.instagram,
      facebookUrl: product.facebookUrl,
      tiktokUrl: product.tiktokUrl,
      twitterUrl: product.twitterUrl,
      productTypes: productTypeMap.get(`${companyId}-${productId}`) ?? [],
    };
  }
}
