import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_LINKS: Array<{
  slug: string;
  destination: string;
  title: string;
  tags: string[];
  expiresInDays?: number; // negative = already expired
}> = [
  { slug: 'google', destination: 'https://www.google.com', title: 'Google homepage', tags: ['search', 'tool'] },
  { slug: 'github', destination: 'https://github.com', title: 'GitHub', tags: ['dev', 'tool'] },
  { slug: 'docs', destination: 'https://nestjs.com', title: 'NestJS docs', tags: ['dev', 'docs'] },
  { slug: 'prisma', destination: 'https://www.prisma.io/docs', title: 'Prisma docs', tags: ['dev', 'docs'] },
  { slug: 'launch', destination: 'https://example.com/product-launch', title: 'Product launch page', tags: ['marketing', 'campaign'] },
  { slug: 'promo-q2', destination: 'https://example.com/promo-q2', title: 'Q2 promo landing', tags: ['marketing', 'campaign'], expiresInDays: 14 },
  { slug: 'promo-q1', destination: 'https://example.com/promo-q1', title: 'Q1 promo landing (expired)', tags: ['marketing', 'campaign'], expiresInDays: -30 },
  { slug: 'newsletter', destination: 'https://example.com/newsletter', title: 'Newsletter signup', tags: ['marketing'] },
  { slug: 'careers', destination: 'https://example.com/careers', title: 'Careers page', tags: ['hr', 'work'] },
  { slug: 'onboarding', destination: 'https://example.com/onboarding', title: 'New employee onboarding', tags: ['hr', 'internal'] },
  { slug: 'wiki', destination: 'https://example.com/wiki', title: 'Internal wiki', tags: ['internal', 'docs'] },
  { slug: 'standup', destination: 'https://meet.example.com/standup', title: 'Daily standup', tags: ['internal', 'work'] },
  { slug: 'roadmap', destination: 'https://example.com/roadmap', title: 'Public roadmap', tags: ['product'] },
  { slug: 'changelog', destination: 'https://example.com/changelog', title: 'Changelog', tags: ['product', 'docs'] },
  { slug: 'pricing', destination: 'https://example.com/pricing', title: 'Pricing page', tags: ['marketing', 'product'] },
  { slug: 'demo', destination: 'https://example.com/demo', title: 'Book a demo', tags: ['marketing', 'sales'] },
  { slug: 'tw-post', destination: 'https://twitter.com/example', title: 'Twitter post link', tags: ['social', 'marketing'] },
  { slug: 'ig-post', destination: 'https://instagram.com/example', title: 'Instagram post link', tags: ['social', 'marketing'] },
  { slug: 'fb-event', destination: 'https://facebook.com/events/123', title: 'FB event', tags: ['social', 'campaign'] },
  { slug: 'yt-vid', destination: 'https://youtube.com/watch?v=demo', title: 'Demo video', tags: ['social', 'product'] },
  { slug: 'old-blog', destination: 'https://example.com/old-blog', title: 'Old blog post', tags: ['archive'], expiresInDays: -7 },
  { slug: 'whitepaper', destination: 'https://example.com/whitepaper.pdf', title: 'Whitepaper PDF', tags: ['marketing', 'docs'] },
  { slug: 'survey', destination: 'https://forms.example.com/survey', title: 'Customer survey', tags: ['research'], expiresInDays: 3 },
  { slug: 'app-ios', destination: 'https://apps.apple.com/example', title: 'iOS app', tags: ['product', 'mobile'] },
  { slug: 'app-android', destination: 'https://play.google.com/store/apps/example', title: 'Android app', tags: ['product', 'mobile'] },
];

const REFERRERS = ['twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'google.com', 'direct', 'reddit.com', 'news.ycombinator.com'];
const COUNTRIES = ['TH', 'US', 'JP', 'SG', 'GB', 'DE', 'VN', 'ID', 'AU', 'IN'];
const DEVICES = ['mobile', 'desktop', 'tablet'] as const;
const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithin(days: number): Date {
  const now = Date.now();
  const offset = Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.click.deleteMany();
  await prisma.link.deleteMany();

  for (const entry of SAMPLE_LINKS) {
    const createdAt = randomDateWithin(30);
    const expiresAt =
      entry.expiresInDays !== undefined
        ? new Date(Date.now() + entry.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const link = await prisma.link.create({
      data: {
        slug: entry.slug,
        destination: entry.destination,
        title: entry.title,
        tags: JSON.stringify(entry.tags),
        createdAt,
        expiresAt,
      },
    });

    // Weight popular slugs more heavily so /stats/top is interesting.
    const popularity = ['google', 'github', 'launch', 'demo', 'yt-vid'].includes(entry.slug)
      ? 80 + Math.floor(Math.random() * 50)
      : 5 + Math.floor(Math.random() * 30);

    const clicks = [];
    for (let i = 0; i < popularity; i++) {
      clicks.push({
        linkId: link.id,
        timestamp: randomDateWithin(30),
        referrer: pick(REFERRERS),
        country: pick(COUNTRIES),
        device: pick(DEVICES),
        userAgent: pick(USER_AGENTS),
      });
    }
    if (clicks.length) {
      await prisma.click.createMany({ data: clicks });
    }
  }

  const totalLinks = await prisma.link.count();
  const totalClicks = await prisma.click.count();
  console.log(`✅ Seeded ${totalLinks} links and ${totalClicks} clicks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
