import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mirror-baca dari tabel native apivisitor (bukan mirror hasil sync -
 * shared Postgres, apivisitor yang nulis, apiexhibitor cuma baca). */
@Entity('link_click_log')
export class LinkClickLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'events_id', type: 'int' })
  eventsId: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId: number | null;

  @Column({ name: 'guests_id', type: 'int', nullable: true })
  guestsId: number | null;

  @Column({ name: 'link_type', type: 'varchar', length: 20 })
  linkType: string;

  @Column({ name: 'clicked_at', type: 'timestamptz' })
  clickedAt: Date;
}
