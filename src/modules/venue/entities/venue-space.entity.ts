import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('venue_space')
export class VenueSpace {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'space_name', type: 'varchar', length: 100, nullable: true })
  spaceName: string;

  @Column({ name: 'space_details', type: 'varchar', length: 255, nullable: true })
  spaceDetails: string;

  @Column({ name: 'venue_id', type: 'int' })
  venueId: number;

  @Column({ name: 'logo', type: 'varchar', length: 100, nullable: true })
  logo: string;

  @Column({ name: 'space_type', type: 'varchar', length: 2 })
  spaceType: string;
}
