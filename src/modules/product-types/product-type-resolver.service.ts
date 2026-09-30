import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductType } from './entities/product-type.entity';
import { ExhibitorProductHasType } from './entities/exhibitor-product-has-type.entity';

export interface ProductTypeLabel {
  id: number;
  label: string | null;
}

export interface ProductRef {
  companyId: number;
  productId: number;
}

/**
 * Resolver batch-friendly buat product type - port dari apivisitor (sama
 * persis logikanya, cuma pindah lokasi entity). 1 produk bisa punya
 * beberapa type sekaligus (many-to-many lewat exhibitorproduct_has_type).
 *
 * PENTING: `exhibitor_product.id` (productId) TIDAK unik lintas company -
 * dia reset per company, jadi SEMUA query di sini WAJIB ikut filter
 * company_id juga, gak boleh cuma product_id.
 */
@Injectable()
export class ProductTypeResolverService {
  constructor(
    @InjectRepository(ProductType) private readonly typeRepo: Repository<ProductType>,
    @InjectRepository(ExhibitorProductHasType)
    private readonly pivotRepo: Repository<ExhibitorProductHasType>,
  ) {}

  /** Map "companyId-productId" -> daftar product type (bisa >1 per produk) */
  async resolveForProducts(
    eventsId: number,
    products: ProductRef[],
  ): Promise<Map<string, ProductTypeLabel[]>> {
    const result = new Map<string, ProductTypeLabel[]>();
    if (!products.length) return result;

    const productIdsByCompany = new Map<number, Set<number>>();
    for (const p of products) {
      if (!productIdsByCompany.has(p.companyId)) productIdsByCompany.set(p.companyId, new Set());
      productIdsByCompany.get(p.companyId)!.add(p.productId);
    }

    const allPivots: ExhibitorProductHasType[] = [];
    for (const [companyId, productIds] of productIdsByCompany) {
      const pivots = await this.pivotRepo.find({
        where: { eventsId, companyId, productId: In([...productIds]) },
      });
      allPivots.push(...pivots);
    }
    if (!allPivots.length) return result;

    const typeIds = [...new Set(allPivots.map((p) => p.productTypeId))];
    const types = await this.typeRepo.find({ where: { eventsId, id: In(typeIds) } });
    const typeMap = new Map(types.map((t) => [t.id, t.label]));

    for (const pivot of allPivots) {
      const key = `${pivot.companyId}-${pivot.productId}`;
      const list = result.get(key) ?? [];
      if (!list.some((t) => t.id === pivot.productTypeId)) {
        list.push({ id: pivot.productTypeId, label: typeMap.get(pivot.productTypeId) ?? null });
      }
      result.set(key, list);
    }
    return result;
  }

  /**
   * Daftar semua product type dalam 1 event beserta jumlah produk-nya -
   * buat filter chip "All (24) | Automation | IoT | AI | Sensor" di UI.
   */
  async listWithProductCount(
    eventsId: number,
  ): Promise<Array<{ id: number; label: string | null; productCount: number }>> {
    const [types, pivots] = await Promise.all([
      this.typeRepo.find({ where: { eventsId, approvalStatus: 'AP' } }),
      this.pivotRepo.find({ where: { eventsId } }),
    ]);

    const uniqueProductsByType = new Map<number, Set<string>>();
    for (const pivot of pivots) {
      if (!uniqueProductsByType.has(pivot.productTypeId)) {
        uniqueProductsByType.set(pivot.productTypeId, new Set());
      }
      uniqueProductsByType.get(pivot.productTypeId)!.add(`${pivot.companyId}-${pivot.productId}`);
    }

    return types
      .map((t) => ({
        id: t.id,
        label: t.label,
        productCount: uniqueProductsByType.get(t.id)?.size ?? 0,
      }))
      .filter((t) => t.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount);
  }
}
