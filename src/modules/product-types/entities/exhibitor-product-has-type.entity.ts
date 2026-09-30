import { Entity, PrimaryColumn } from 'typeorm';

/**
 * Tabel pivot: 1 produk bisa punya beberapa product_type sekaligus.
 * Kolom `product_type` di sini adalah FK ke `product_type.id` - dikasih
 * nama property `productTypeId` biar gak bentrok sama nama entity ProductType.
 */
@Entity('exhibitorproduct_has_type')
export class ExhibitorProductHasType {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'company_id', type: 'int' })
  companyId: number;

  @PrimaryColumn({ name: 'product_id', type: 'int' })
  productId: number;

  @PrimaryColumn({ name: 'product_type', type: 'int' })
  productTypeId: number;
}
