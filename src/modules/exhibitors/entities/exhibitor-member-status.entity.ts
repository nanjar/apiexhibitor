import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Mirror dari MySQL exhibitor_member_status_sync. Status keanggotaan
 * booth: INVITED / ACTIVE / REMOVED + permission granular.
 *
 * PENTING: hanya ditulis LANGSUNG oleh apiexhibitor untuk kasus bootstrap
 * login pertama kali (lihat auth.service.ts) - di luar itu, semua
 * perubahan (invite/activate/remove dari User Management screen) HARUS
 * lewat ExhibitorMemberAction (staging), bukan repo ini langsung, supaya
 * gak ketimpa pull-sync berikutnya.
 */
@Entity('exhibitor_member_status_sync')
export class ExhibitorMemberStatus {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'exhibitor_id', type: 'int' })
  exhibitorId: number;

  @Column({ name: 'member_status', type: 'varchar', length: 10, default: 'ACTIVE' })
  memberStatus: 'INVITED' | 'ACTIVE' | 'REMOVED';

  @Column({ name: 'can_scan', type: 'char', length: 1, default: 'Y' })
  canScan: string;

  @Column({ name: 'can_chat', type: 'char', length: 1, default: 'Y' })
  canChat: string;

  @Column({ name: 'is_owner', type: 'char', length: 1, default: 'N' })
  isOwner: string;

  @Column({ name: 'invited_by', type: 'int', nullable: true })
  invitedBy: number | null;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt: Date | null;

  @Column({ name: 'last_update', type: 'timestamptz' })
  lastUpdate: Date;
}
