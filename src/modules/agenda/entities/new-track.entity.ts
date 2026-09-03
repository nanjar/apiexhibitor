import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('new_track')
export class NewTrack {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'track_name', type: 'varchar', length: 100, nullable: true })
  trackName: string;

  @Column({ name: 'alias_name', type: 'varchar', length: 100, nullable: true })
  aliasName: string;

  @Column({ name: 'agenda_id', type: 'int' })
  agendaId: number;

  @Column({ name: 'logo', type: 'varchar', length: 100, nullable: true })
  logo: string;

  @Column({ name: 'sort_no', type: 'int', default: 1 })
  sortNo: number;
}
