import { Entity, PrimaryColumn } from 'typeorm';

/** Mirror dari MySQL exhibitor_have_company. Satu exhibitor bisa punya
 * banyak baris (mewakili banyak company). */
@Entity('exhibitor_have_company')
export class ExhibitorHaveCompany {
  @PrimaryColumn({ name: 'events_id', type: 'int' })
  eventsId: number;

  @PrimaryColumn({ name: 'exhibitor_id', type: 'int' })
  exhibitorId: number;

  @PrimaryColumn({ name: 'company_id', type: 'int' })
  companyId: number;
}
