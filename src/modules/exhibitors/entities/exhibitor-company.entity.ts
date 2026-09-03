import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('exhibitor_company')
export class ExhibitorCompany {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName: string;

  @Column({ name: 'logo', type: 'varchar', length: 255, nullable: true })
  logo: string;
}
