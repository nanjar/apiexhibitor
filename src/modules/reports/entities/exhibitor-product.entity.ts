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
}
