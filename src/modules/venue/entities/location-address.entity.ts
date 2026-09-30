import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Nama & alamat venue. Kolom `id` di sini konseptual = venue_id (sama
 * pola dengan apivisitor - PK (id, events_id), join ke venue_space.venue_id
 * untuk dapat nama venue penuh).
 */
@Entity('location_address')
export class LocationAddress {
  @PrimaryColumn({ name: 'id', type: 'int' })
  venueId: number;

  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'ev_venue', type: 'varchar', length: 100, nullable: true })
  venueName: string | null;
}
