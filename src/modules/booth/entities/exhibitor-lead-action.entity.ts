import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Staging native. action='CREATE' bikin lead baru, action='UPDATE_NOTES'
 * edit notes lead yang sudah confirmed (leadId = id MySQL asli). */
@Entity('exhibitor_app_lead_action')
export class ExhibitorLeadAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'venue_id', type: 'int' })
  venueId: number;

  @Column({ name: 'space_id', type: 'int' })
  spaceId: number;

  @Column({ name: 'actor_exhibitor_id', type: 'int' })
  actorExhibitorId: number;

  @Column({ name: 'guests_id', type: 'int', nullable: true })
  guestsId: number | null;

  @Column({ name: 'source', type: 'varchar', length: 15, nullable: true })
  source: 'SCAN' | 'EVENT_GUEST' | 'MANUAL' | null;

  @Column({ name: 'manual_fullname', type: 'varchar', length: 100, nullable: true })
  manualFullname: string | null;

  @Column({ name: 'manual_phone', type: 'varchar', length: 25, nullable: true })
  manualPhone: string | null;

  @Column({ name: 'manual_company', type: 'varchar', length: 200, nullable: true })
  manualCompany: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'action', type: 'varchar', length: 15, default: 'CREATE' })
  action: 'CREATE' | 'UPDATE_NOTES';

  @Column({ name: 'lead_id', type: 'int', nullable: true })
  leadId: number | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'pushed_at', type: 'timestamptz', nullable: true })
  pushedAt: Date | null;
}
