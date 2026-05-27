import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { StatsService } from './stats.service';

enum TopMetric {
  Clicks = 'clicks',
  Recent = 'recent',
}

enum TopPeriod {
  Week = '7d',
  Month = '30d',
  All = 'all',
}

class TopQueryDto {
  @ApiPropertyOptional({ enum: TopMetric, default: TopMetric.Clicks })
  @IsOptional()
  @IsEnum(TopMetric)
  metric?: TopMetric = TopMetric.Clicks;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 5;

  @ApiPropertyOptional({ enum: TopPeriod, default: TopPeriod.All })
  @IsOptional()
  @IsEnum(TopPeriod)
  period?: TopPeriod = TopPeriod.All;
}

class ExpiringQueryDto {
  @ApiPropertyOptional({
    description: 'Time window (e.g. "7d", "30d"). Default: 7d',
    default: '7d',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+d$/, { message: 'within must be like "7d", "30d"' })
  within?: string = '7d';
}

@ApiTags('stats')
@Controller()
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('stats/summary')
  @ApiOperation({ summary: 'Overall account stats' })
  summary() {
    return this.stats.summary();
  }

  @Get('stats/top')
  @ApiOperation({ summary: 'Top performing links' })
  top(@Query() q: TopQueryDto) {
    return this.stats.top(q.metric!, q.limit!, q.period!);
  }

  @Get('links/expiring')
  @ApiOperation({ summary: 'Links expiring within a time window' })
  expiring(@Query() q: ExpiringQueryDto) {
    const days = parseInt(q.within!.replace('d', ''), 10);
    return this.stats.expiring(days);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags with usage count' })
  tags() {
    return this.stats.tags();
  }
}
