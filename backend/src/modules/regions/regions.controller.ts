import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ALL_ROLES, Roles } from '../../common/decorators/auth.decorators';
import { RegionLevel, RegionsService } from './regions.service';

@Controller('regions')
export class RegionsController {
  constructor(private regions: RegionsService) {}

  /** GET /regions?parent=kode — anak wilayah (tanpa parent: provinsi). */
  @Get()
  @Roles(...ALL_ROLES)
  list(@Query('parent') parent?: string) {
    return this.regions.list(parent || undefined);
  }

  /** GET /regions/boundaries?level=1..4&bbox=w,s,e,n&parent=kode */
  @Get('boundaries')
  @Roles(...ALL_ROLES)
  boundaries(@Query() q: { level?: string; bbox?: string; parent?: string }) {
    const level = Number(q.level ?? 1);
    if (![1, 2, 3, 4].includes(level)) throw new BadRequestException({ code: 'INVALID_LEVEL', message: 'level harus 1–4' });
    let bbox: [number, number, number, number] | undefined;
    if (q.bbox) {
      const b = q.bbox.split(',').map(Number);
      if (b.length !== 4 || b.some((n) => !Number.isFinite(n))) throw new BadRequestException({ code: 'INVALID_BBOX', message: 'bbox harus w,s,e,n' });
      bbox = b as [number, number, number, number];
    }
    return this.regions.boundaries(level as RegionLevel, bbox, q.parent || undefined);
  }

  /** GET /regions/at?lat=&lng= — rantai provinsi → desa pada satu titik. */
  @Get('at')
  @Roles(...ALL_ROLES)
  at(@Query('lat') lat: string, @Query('lng') lng: string) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) throw new BadRequestException({ code: 'INVALID_POINT', message: 'lat/lng tidak valid' });
    return this.regions.at(Number(lat), Number(lng));
  }
}
