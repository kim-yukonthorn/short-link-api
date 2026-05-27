import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { LinksModule } from './links/links.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedirectModule } from './redirect/redirect.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    PrismaModule,
    // StatsModule must register before LinksModule so /links/expiring
    // is matched before /links/:slug catches "expiring" as a slug.
    StatsModule,
    LinksModule,
    RedirectModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
