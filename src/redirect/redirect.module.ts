import { Module } from '@nestjs/common';
import { ClickTrackerService } from './click-tracker.service';
import { RedirectController } from './redirect.controller';

@Module({
  controllers: [RedirectController],
  providers: [ClickTrackerService],
  exports: [ClickTrackerService],
})
export class RedirectModule {}
