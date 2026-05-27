import { Module } from '@nestjs/common';
import { LinksModule } from '../links/links.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [LinksModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
