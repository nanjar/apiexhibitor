import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('new_agenda')
export class NewAgenda {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'agenda_name', type: 'varchar', length: 45, nullable: true })
  agendaName: string;

  @Column({ name: 'alias_name', type: 'varchar', length: 100, nullable: true })
  aliasName: string;

  @Column({ name: 'agenda_date', type: 'date', nullable: true })
  agendaDate: string;

  @Column({ name: 'venue_id', type: 'int', default: 0 })
  venueId: number;

  @Column({ name: 'sort_no', type: 'int', default: 1 })
  sortNo: number;
}
