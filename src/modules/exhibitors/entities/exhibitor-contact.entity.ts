import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Mirror dari MySQL `exhibitor` (staff/PIC data), pgTable exhibitor_contact
 * - sama persis dengan entity yang dipakai apivisitor (lihat komentar di
 * sync-tables.config.ts kenapa nama tabelnya beda dari MySQL).
 */
@Entity('exhibitor_contact')
export class ExhibitorContact {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'fullname', type: 'varchar', length: 255, nullable: true })
  fullname: string;

  @Column({ name: 'country_code', type: 'varchar', length: 10, nullable: true })
  countryCode: string;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone: string;

  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId: number;

  @Column({ name: 'approval_status', type: 'varchar', length: 2, nullable: true })
  approvalStatus: string;

  @Column({ name: 'user_level', type: 'varchar', length: 10, nullable: true })
  userLevel: string;

  @Column({ name: 'in_charge', type: 'char', length: 1, nullable: true })
  inCharge: string;

  @Column({ name: 'job_title', type: 'varchar', length: 255, nullable: true })
  jobTitle: string;

  @Column({ name: 'exhibitor_email', type: 'varchar', length: 255, nullable: true })
  exhibitorEmail: string;
}
