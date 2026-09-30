import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Mirror dari MySQL bizmatch_guestsv2 - EXISTS di tabel ini = visitor
 * sudah terdaftar/join di bizmatch app (beda dari guests_ticket yang cuma
 * berarti punya tiket event, belum tentu ikut bizmatch).
 *
 * apps_type ('apps'/'web') murni informasi asal join, bukan filter
 * relevansi buat visitor list.
 */
@Entity('bizmatch_guestsv2')
export class BizmatchGuestsV2 {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'guests_id', type: 'int' })
  guestsId: number;

  @PrimaryColumn({ name: 'member_guests_id', type: 'int' })
  memberGuestsId: number;

  @Column({ name: 'join_date', type: 'timestamptz', nullable: true })
  joinDate: Date | null;

  @Column({ name: 'last_login', type: 'timestamptz', nullable: true })
  lastLogin: Date | null;

  @Column({ name: 'apps_type', type: 'varchar', length: 10, nullable: true })
  appsType: string | null;

  @Column({ name: 'approval_status', type: 'varchar', length: 2, nullable: true })
  approvalStatus: string | null;
}
