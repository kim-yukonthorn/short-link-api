import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum LinkStatus {
  Active = 'active',
  Expired = 'expired',
  All = 'all',
}

export enum LinkSort {
  CreatedAt = 'createdAt',
  Clicks = 'clicks',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export class QueryLinksDto {
  @ApiPropertyOptional({ description: 'Filter by tag (exact match)' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ enum: LinkStatus, default: LinkStatus.All })
  @IsOptional()
  @IsEnum(LinkStatus)
  status?: LinkStatus = LinkStatus.All;

  @ApiPropertyOptional({
    description: 'Search in slug, title, and destination',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'ISO date — createdAt >= from' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — createdAt <= to' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: LinkSort, default: LinkSort.CreatedAt })
  @IsOptional()
  @IsEnum(LinkSort)
  sort?: LinkSort = LinkSort.CreatedAt;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.Desc;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
