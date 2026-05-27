import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Link, Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLinkDto } from './dto/create-link.dto';
import {
  LinkSort,
  LinkStatus,
  QueryLinksDto,
  SortOrder,
} from './dto/query-links.dto';
import { UpdateLinkDto } from './dto/update-link.dto';

const generateSlug = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  6,
);

export type LinkView = Omit<Link, 'tags'> & {
  tags: string[];
  status: 'active' | 'expired';
};

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLinkDto): Promise<LinkView> {
    const slug = dto.slug ?? (await this.generateUniqueSlug());

    try {
      const link = await this.prisma.link.create({
        data: {
          slug,
          destination: dto.destination,
          title: dto.title,
          tags: JSON.stringify(dto.tags ?? []),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
      return this.toView(link);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Slug "${slug}" is already taken`);
      }
      throw err;
    }
  }

  async findAll(query: QueryLinksDto): Promise<{
    data: LinkView[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LinkWhereInput = {};

    if (query.search) {
      where.OR = [
        { slug: { contains: query.search } },
        { title: { contains: query.search } },
        { destination: { contains: query.search } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.status === LinkStatus.Active) {
      where.OR = [
        ...(where.OR ?? []),
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    } else if (query.status === LinkStatus.Expired) {
      where.expiresAt = { lt: new Date() };
    }

    // tag filter: stored as JSON string; SQLite has no JSON contains operator,
    // so we filter in memory after a `contains` prefilter to keep it cheap.
    if (query.tag) {
      where.tags = { contains: `"${query.tag}"` };
    }

    const orderBy: Prisma.LinkOrderByWithRelationInput =
      query.sort === LinkSort.Clicks
        ? { clicks: { _count: query.order ?? SortOrder.Desc } }
        : { createdAt: query.order ?? SortOrder.Desc };

    const [rawTotal, links] = await this.prisma.$transaction([
      this.prisma.link.count({ where }),
      this.prisma.link.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const filtered = query.tag
      ? links.filter((l) =>
          (JSON.parse(l.tags) as string[]).includes(query.tag!),
        )
      : links;

    return {
      data: filtered.map((l) => this.toView(l)),
      pagination: {
        page,
        limit,
        total: rawTotal,
        totalPages: Math.max(1, Math.ceil(rawTotal / limit)),
      },
    };
  }

  async findOneBySlug(slug: string): Promise<
    LinkView & {
      totalClicks: number;
      uniqueClicks: number;
      shortUrl?: string;
    }
  > {
    const link = await this.prisma.link.findUnique({
      where: { slug },
      include: { _count: { select: { clicks: true } } },
    });
    if (!link) throw new NotFoundException(`Link "${slug}" not found`);

    const uniqueRows = await this.prisma.click.groupBy({
      by: ['userAgent'],
      where: { linkId: link.id },
    });

    const { _count, ...rest } = link;
    return {
      ...this.toView(rest as Link),
      totalClicks: _count.clicks,
      uniqueClicks: uniqueRows.length,
    };
  }

  async update(slug: string, dto: UpdateLinkDto): Promise<LinkView> {
    await this.assertExists(slug);
    const link = await this.prisma.link.update({
      where: { slug },
      data: {
        destination: dto.destination,
        title: dto.title,
        tags: dto.tags ? JSON.stringify(dto.tags) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
    return this.toView(link);
  }

  async remove(slug: string): Promise<void> {
    await this.assertExists(slug);
    await this.prisma.link.delete({ where: { slug } });
  }

  toView(link: Link): LinkView {
    const tags = JSON.parse(link.tags) as string[];
    const status: 'active' | 'expired' =
      link.expiresAt && link.expiresAt < new Date() ? 'expired' : 'active';
    return { ...link, tags, status };
  }

  private async assertExists(slug: string): Promise<void> {
    const found = await this.prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Link "${slug}" not found`);
  }

  private async generateUniqueSlug(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = generateSlug();
      const exists = await this.prisma.link.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new ConflictException('Could not generate a unique slug');
  }
}
