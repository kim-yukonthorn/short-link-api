import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LinksService } from '../links/links.service';

export interface StatsSummary {
  totalLinks: number;
  activeLinks: number;
  expiredLinks: number;
  totalClicks: number;
  clicksLast7Days: number;
  topTag: { tag: string; count: number } | null;
}

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: LinksService,
  ) {}

  async summary(): Promise<StatsSummary> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalLinks, expiredLinks, totalClicks, clicksLast7Days, allLinks] =
      await this.prisma.$transaction([
        this.prisma.link.count(),
        this.prisma.link.count({ where: { expiresAt: { lt: now } } }),
        this.prisma.click.count(),
        this.prisma.click.count({
          where: { timestamp: { gte: sevenDaysAgo } },
        }),
        this.prisma.link.findMany({ select: { tags: true } }),
      ]);

    const tagCounts = new Map<string, number>();
    for (const link of allLinks) {
      const tags = JSON.parse(link.tags) as string[];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topTag = sortedTags[0]
      ? { tag: sortedTags[0][0], count: sortedTags[0][1] }
      : null;

    return {
      totalLinks,
      activeLinks: totalLinks - expiredLinks,
      expiredLinks,
      totalClicks,
      clicksLast7Days,
      topTag,
    };
  }

  async top(
    metric: 'clicks' | 'recent',
    limit: number,
    period: '7d' | '30d' | 'all',
  ) {
    const periodFilter =
      period === 'all' ? undefined : new Date(Date.now() - periodMs(period));

    if (metric === 'recent') {
      const links = await this.prisma.link.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { _count: { select: { clicks: true } } },
      });
      return {
        data: links.map((l) => ({
          slug: l.slug,
          destination: l.destination,
          title: l.title,
          clicks: l._count.clicks,
          createdAt: l.createdAt,
        })),
      };
    }

    // metric === clicks: group clicks (optionally filtered by period), then join to links.
    const grouped = await this.prisma.click.groupBy({
      by: ['linkId'],
      where: periodFilter ? { timestamp: { gte: periodFilter } } : undefined,
      _count: { linkId: true },
      orderBy: { _count: { linkId: 'desc' } },
      take: limit,
    });

    const links = await this.prisma.link.findMany({
      where: { id: { in: grouped.map((g) => g.linkId) } },
    });
    const linkMap = new Map(links.map((l) => [l.id, l]));

    return {
      data: grouped
        .map((g) => {
          const link = linkMap.get(g.linkId);
          if (!link) return null;
          return {
            slug: link.slug,
            destination: link.destination,
            title: link.title,
            clicks: g._count.linkId,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    };
  }

  async expiring(withinDays: number) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    const links = await this.prisma.link.findMany({
      where: {
        expiresAt: { gte: now, lte: cutoff },
      },
      orderBy: { expiresAt: 'asc' },
    });
    return { data: links.map((l) => this.links.toView(l)) };
  }

  async tags() {
    const all = await this.prisma.link.findMany({ select: { tags: true } });
    const counts = new Map<string, number>();
    for (const link of all) {
      const tags = JSON.parse(link.tags) as string[];
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return {
      data: [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}

function periodMs(period: '7d' | '30d'): number {
  return period === '7d'
    ? 7 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
}
