import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Staging table NATIVE (bukan mirror) untuk approve/reject meeting dari
 * exhibitor app. Ditulis langsung oleh apivisitor saat exhibitor menekan
 * Setujui/Tolak. pushed_at NULL = belum diproses push-job ke MySQL
 * (events_meeting_v2.approval_status / Status).
 *
 * Kenapa tidak langsung UPDATE events_meeting_v2: tabel itu mirror hasil
 * pull-sync MySQL->Postgres, ditimpa tiap cron jalan - sama seperti kasus
 * guests_ticket.device_id yang pernah jadi masalah (lihat README apivisitor).
 */
@Entity('exhibitor_app_meeting_action')
export class ExhibitorMeetingAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'meeting_id', type: 'int' })
  meetingId: number;

  @Column({ name: 'action', type: 'varchar', length: 10 })
  action: 'APPROVE' | 'REJECT';

  @Column({ name: 'actor_exhibitor_id', type: 'int' })
  actorExhibitorId: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'score', type: 'varchar', length: 50, nullable: true })
  score: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'pushed_at', type: 'timestamptz', nullable: true })
  pushedAt: Date | null;
}
