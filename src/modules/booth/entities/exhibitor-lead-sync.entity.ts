import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mirror dari MySQL exhibitor_lead_sync - source of truth My Booth lead
 * list, independen dari checkin_booth. */
@Entity('exhibitor_lead_sync')
export class ExhibitorLeadSync {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'venue_id', type: 'int' })
  venueId: number;

  @Column({ name: 'space_id', type: 'int' })
  spaceId: number;

  @Column({ name: 'exhibitor_id', type: 'int' })
  exhibitorId: number;

  @Column({ name: 'guests_id', type: 'int', nullable: true })
  guestsId: number | null;

  @Column({ name: 'source', type: 'varchar', length: 15 })
  source: 'SCAN' | 'EVENT_GUEST' | 'MANUAL';

  @Column({ name: 'manual_fullname', type: 'varchar', length: 100, nullable: true })
  manualFullname: string | null;

  @Column({ name: 'manual_phone', type: 'varchar', length: 25, nullable: true })
  manualPhone: string | null;

  @Column({ name: 'manual_company', type: 'varchar', length: 200, nullable: true })
  manualCompany: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_update', type: 'timestamptz' })
  lastUpdate: Date;
}
