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

  // Kolom di bawah sudah ada di mirror (pull-synced) - baru dipetakan di
  // sini buat Companies directory (lihat CompaniesService).
  @Column({ name: 'details', type: 'text', nullable: true })
  details: string | null;

  @Column({ name: 'approval_status', type: 'varchar', length: 2, default: 'AP' })
  approvalStatus: string;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'company_profile_url', type: 'varchar', length: 250, nullable: true })
  companyProfileUrl: string | null;

  @Column({ name: 'company_website', type: 'varchar', length: 250, nullable: true })
  companyWebsite: string | null;
}
