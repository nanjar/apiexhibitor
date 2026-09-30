import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('exhibitor_product')
export class ExhibitorProduct {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'company_id', type: 'int' })
  companyId: number;

  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'product_name', type: 'varchar', length: 250, nullable: true })
  productName: string;

  // Kolom di bawah sudah ada di mirror (pull-synced) - baru dipetakan di
  // sini buat Booth Info (lihat BoothService.getBoothInfo()).
  @Column({ name: 'product_logo', type: 'varchar', length: 255, nullable: true })
  productLogo: string | null;

  @Column({ name: 'product_description', type: 'text', nullable: true })
  productDescription: string | null;

  @Column({ name: 'approval_status', type: 'varchar', length: 2, default: 'AP' })
  approvalStatus: string;
}
