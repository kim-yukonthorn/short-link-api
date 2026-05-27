import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ClickTrackerService } from './click-tracker.service';

@ApiExcludeController()
@Controller('r')
export class RedirectController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: ClickTrackerService,
  ) {}

  @Get(':slug')
  async redirect(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const link = await this.prisma.link.findUnique({
      where: { slug },
      select: { id: true, destination: true, expiresAt: true },
    });
    if (!link) throw new NotFoundException('Short link not found');

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new HttpException('Short link has expired', HttpStatus.GONE);
    }

    this.tracker.track({
      linkId: link.id,
      referrer: req.get('referer') ?? undefined,
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });

    res.redirect(HttpStatus.FOUND, link.destination);
  }
}
