import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mirror dari MySQL guests_ticket - dipakai buat ambil nama requester
 * meeting/visitor (bukan untuk fitur tiket visitor, itu domain apivisitor). */
@Entity('guests_ticket')
export class GuestsTicket {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'guests_id', type: 'int' })
  guestsId: number;

  @Column({ name: 'fullname', type: 'varchar', length: 100, nullable: true })
  fullname: string;

  @Column({ name: 'guest_title', type: 'varchar', length: 6, nullable: true })
  guestTitle: string;
}
