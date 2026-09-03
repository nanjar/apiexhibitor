import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Native (bukan mirror) - device token FCM, dicatat tiap login. Lihat
 * migration CreateExhibitorDeviceTokenTable di repo apivisitor untuk
 * alasan kenapa ini tabel terpisah, bukan kolom di exhibitor_contact.
 */
@Entity('exhibitor_device_token')
export class ExhibitorDeviceToken {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'exhibitor_id', type: 'int' })
  exhibitorId: number;

  @PrimaryColumn({ name: 'device_id', type: 'varchar', length: 255 })
  deviceId: string;

  @Column({ name: 'platform', type: 'varchar', length: 10, nullable: true })
  platform: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;
}
