import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Staging native (dari repo apivisitor migration, dipakai bersama) untuk
 * aksi invite/activate/remove/restore anggota booth. Push-job di
 * bizmatch-backend-sync yang memproses pushed_at IS NULL ke MySQL.
 */
@Entity('exhibitor_app_member_action')
export class ExhibitorMemberAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  // Nullable - untuk action='CREATE', id belum ada (auto-increment MySQL,
  // baru ke-assign setelah push-job jalan).
  @Column({ name: 'exhibitor_id', type: 'int', nullable: true })
  exhibitorId: number | null;

  @Column({ name: 'action', type: 'varchar', length: 10 })
  action: 'INVITE' | 'ACTIVATE' | 'REMOVE' | 'RESTORE' | 'UPDATE_PERMISSION' | 'CREATE';

  @Column({ name: 'actor_exhibitor_id', type: 'int' })
  actorExhibitorId: number;

  // CUMA dipakai action='CREATE' - filter listMembers() per company sebelum
  // exhibitor_have_company sempat ke-insert (baru dibuat push-job).
  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId: number | null;

  @Column({ name: 'can_scan', type: 'char', length: 1, nullable: true })
  canScan: string | null;

  @Column({ name: 'can_chat', type: 'char', length: 1, nullable: true })
  canChat: string | null;

  // Kolom di bawah CUMA dipakai untuk action='CREATE' - data orang baru
  // yang belum punya row exhibitor_contact sama sekali.
  @Column({ name: 'fullname', type: 'varchar', length: 255, nullable: true })
  fullname: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 10, nullable: true })
  countryCode: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'job_title', type: 'varchar', length: 255, nullable: true })
  jobTitle: string | null;

  @Column({ name: 'user_level', type: 'varchar', length: 10, nullable: true })
  userLevel: string | null;

  @Column({ name: 'exhibitor_email', type: 'varchar', length: 255, nullable: true })
  exhibitorEmail: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'pushed_at', type: 'timestamptz', nullable: true })
  pushedAt: Date | null;
}
