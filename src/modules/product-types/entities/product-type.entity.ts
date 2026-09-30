import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('product_type')
export class ProductType {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  // Nama tipe produk (mis. "Automation", "IoT", "AI", "Sensor") - nama
  // kolomnya "deskripsi" di skema asli walau isinya lebih ke label/nama.
  @Column({ name: 'deskripsi', type: 'text', nullable: true })
  label: string | null;

  @Column({ name: 'approval_status', type: 'varchar', length: 2, nullable: true })
  approvalStatus: string | null;
}
