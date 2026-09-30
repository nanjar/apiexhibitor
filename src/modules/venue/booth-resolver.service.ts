import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExhcompanySpace } from './entities/exhcompany-space.entity';
import { VenueSpace } from './entities/venue-space.entity';
import { LocationAddress } from './entities/location-address.entity';

export interface BoothLocation {
  venueName: string | null;
  hallLabel: string | null;
  boothLabel: string | null;
}

const EMPTY_LOCATION: BoothLocation = { venueName: null, hallLabel: null, boothLabel: null };

/**
 * Resolve lokasi booth RESMI 1/banyak company sekaligus (batch-friendly,
 * hindari N+1) - dipakai Companies directory buat nampilin lokasi booth
 * company lain. Port dari BoothResolverService apivisitor (sumber &
 * caveat sama - exhcompany_space = assignment resmi, BUKAN checkin_booth
 * yang isinya riwayat scan visitor).
 */
@Injectable()
export class BoothResolverService {
  private readonly logger = new Logger(BoothResolverService.name);

  constructor(
    @InjectRepository(ExhcompanySpace)
    private readonly exhCompanySpaceRepo: Repository<ExhcompanySpace>,
    @InjectRepository(VenueSpace)
    private readonly venueSpaceRepo: Repository<VenueSpace>,
    @InjectRepository(LocationAddress)
    private readonly locationAddressRepo: Repository<LocationAddress>,
  ) {}

  async resolveMany(eventsId: number, companyIds: number[]): Promise<Map<number, BoothLocation>> {
    const result = new Map<number, BoothLocation>();
    if (!companyIds.length) return result;

    // Defensif - jangan sampai tabel belum ke-sync bikin Companies
    // directory ikut error, cukup null-kan field lokasinya.
    let links: ExhcompanySpace[];
    try {
      links = await this.exhCompanySpaceRepo.find({
        where: { eventsId, companyId: In(companyIds) },
      });
    } catch (err: any) {
      this.logger.warn(
        `Gagal query exhcompany_space, venueName/hallLabel/boothLabel akan null: ${err.message}`,
      );
      return result;
    }
    if (!links.length) return result;

    const linkByCompany = new Map<number, ExhcompanySpace>();
    for (const link of links) {
      if (!linkByCompany.has(link.companyId)) {
        linkByCompany.set(link.companyId, link);
      }
    }

    const venueIds = [...new Set([...linkByCompany.values()].map((l) => l.venueId))];

    let spaces: VenueSpace[] = [];
    let venues: LocationAddress[] = [];
    try {
      [spaces, venues] = await Promise.all([
        this.venueSpaceRepo.find({ where: { eventsId } }),
        this.locationAddressRepo.find({ where: { eventsId, venueId: In(venueIds) } }),
      ]);
    } catch (err: any) {
      this.logger.warn(`Gagal query venue_space/location_address, venueName akan null: ${err.message}`);
    }

    const spaceMap = new Map(spaces.map((s) => [`${s.venueId}-${s.id}`, s]));
    const venueMap = new Map(venues.map((v) => [v.venueId, v]));

    for (const [companyId, link] of linkByCompany) {
      const space = spaceMap.get(`${link.venueId}-${link.spaceId}`);
      const venue = venueMap.get(link.venueId);
      result.set(companyId, {
        venueName: venue?.venueName ?? null,
        hallLabel: space?.spaceName ?? null,
        boothLabel: space?.spaceDetails ?? null,
      });
    }
    return result;
  }

  async resolveOne(eventsId: number, companyId: number): Promise<BoothLocation> {
    const map = await this.resolveMany(eventsId, [companyId]);
    return map.get(companyId) ?? EMPTY_LOCATION;
  }
}
