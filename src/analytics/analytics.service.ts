import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueClicks: number;
  clicksByDay: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
  deviceBreakdown: Record<string, number>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(slug: string): Promise<AnalyticsSummary> {
    const link = await this.findLinkOrThrow(slug);

    const clicks = await this.prisma.click.findMany({
      where: { linkId: link.id },
      select: {
        timestamp: true,
        referrer: true,
        country: true,
        device: true,
        userAgent: true,
      },
    });

    const totalClicks = clicks.length;
    const uniqueClicks = new Set(clicks.map((c) => c.userAgent ?? '')).size;

    const byDay = new Map<string, number>();
    const byReferrer = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const byDevice: Record<string, number> = {};

    for (const c of clicks) {
      const day = c.timestamp.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);

      const ref = c.referrer ?? 'direct';
      byReferrer.set(ref, (byReferrer.get(ref) ?? 0) + 1);

      const country = c.country ?? 'unknown';
      byCountry.set(country, (byCountry.get(country) ?? 0) + 1);

      const device = c.device ?? 'desktop';
      byDevice[device] = (byDevice[device] ?? 0) + 1;
    }

    return {
      totalClicks,
      uniqueClicks,
      clicksByDay: [...byDay.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topReferrers: topN(byReferrer, 5).map(([referrer, count]) => ({
        referrer,
        count,
      })),
      topCountries: topN(byCountry, 5).map(([country, count]) => ({
        country,
        count,
      })),
      deviceBreakdown: byDevice,
    };
  }

  async listClicks(
    slug: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: {
      timestamp: Date;
      referrer: string | null;
      country: string | null;
      device: string | null;
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const link = await this.findLinkOrThrow(slug);

    const [total, clicks] = await this.prisma.$transaction([
      this.prisma.click.count({ where: { linkId: link.id } }),
      this.prisma.click.findMany({
        where: { linkId: link.id },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          timestamp: true,
          referrer: true,
          country: true,
          device: true,
        },
      }),
    ]);

    return {
      data: clicks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private async findLinkOrThrow(slug: string) {
    const link = await this.prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!link) throw new NotFoundException(`Link "${slug}" not found`);
    return link;
  }
}

function topN<K>(map: Map<K, number>, n: number): [K, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
