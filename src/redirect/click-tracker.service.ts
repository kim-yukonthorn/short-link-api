import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { PrismaService } from '../prisma/prisma.service';

export interface ClickContext {
  linkId: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class ClickTrackerService {
  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget: errors are swallowed so a tracking failure never breaks the redirect.
  track(ctx: ClickContext): void {
    void this.recordClick(ctx).catch(() => {});
  }

  private async recordClick(ctx: ClickContext): Promise<void> {
    const device = ctx.userAgent ? deviceFromUA(ctx.userAgent) : null;
    await this.prisma.click.create({
      data: {
        linkId: ctx.linkId,
        referrer: normalizeReferrer(ctx.referrer),
        userAgent: ctx.userAgent ?? null,
        device,
        country: fakeCountryFromIp(ctx.ip),
      },
    });
  }
}

function deviceFromUA(ua: string): string {
  const parsed = new UAParser(ua).getDevice();
  if (parsed.type === 'mobile') return 'mobile';
  if (parsed.type === 'tablet') return 'tablet';
  return 'desktop';
}

function normalizeReferrer(ref?: string): string {
  if (!ref) return 'direct';
  try {
    return new URL(ref).hostname;
  } catch {
    return 'direct';
  }
}

// Demo helper — real GeoIP lookup is out of scope. Returns a stable fake.
function fakeCountryFromIp(ip?: string): string {
  if (!ip) return 'TH';
  const buckets = ['TH', 'US', 'JP', 'SG', 'GB', 'DE', 'VN', 'ID'];
  const hash = ip
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return buckets[hash % buckets.length];
}
