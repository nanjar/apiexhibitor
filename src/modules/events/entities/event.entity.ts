import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Mirror dari MySQL `events` (subset kolom yang relevan untuk exhibitor
 * app). evToken SENGAJA bisa dibaca di sini (beda dari apivisitor yang
 * pakai select:false) - apiexhibitor butuh field ini buat validasi login
 * event key.
 */
@Entity('events')
export class Event {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'ev_desc', type: 'varchar', length: 255, nullable: true })
  evDesc: string;

  @Column({ name: 'ev_token', type: 'varchar', length: 200, nullable: true })
  evToken: string | null;

  @Column({ name: 'status', type: 'varchar', length: 10, nullable: true })
  status: string;
}
