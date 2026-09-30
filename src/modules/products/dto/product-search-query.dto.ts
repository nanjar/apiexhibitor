import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ProductSearchQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  // Filter berdasarkan product type (dari filter chip: Automation/IoT/AI/dst)
  // Bisa 1 nilai (?productTypeId=1) atau banyak (?productTypeId=1&productTypeId=2)
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]).map(Number))
  @IsInt({ each: true })
  productTypeId?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}
