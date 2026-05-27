import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AnalyticsService } from './analytics.service';

class ClickQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

@ApiTags('analytics')
@Controller('links/:slug')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Aggregated click stats for a link' })
  getAnalytics(@Param('slug') slug: string) {
    return this.analytics.getAnalytics(slug);
  }

  @Get('clicks')
  @ApiOperation({ summary: 'Raw click events (paginated, newest first)' })
  listClicks(@Param('slug') slug: string, @Query() q: ClickQueryDto) {
    return this.analytics.listClicks(slug, q.page, q.limit);
  }
}
