import { Entity, PrimaryColumn } from 'typeorm';

@Entity('exhcompany_space')
export class ExhcompanySpace {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'venue_id', type: 'int' })
  venueId: number;

  @PrimaryColumn({ name: 'space_id', type: 'int' })
  spaceId: number;

  @PrimaryColumn({ name: 'company_id', type: 'int' })
  companyId: number;
}
