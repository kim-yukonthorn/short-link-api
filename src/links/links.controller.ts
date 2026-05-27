import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CreateLinkDto } from './dto/create-link.dto';
import { QueryLinksDto } from './dto/query-links.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { LinksService } from './links.service';

@ApiTags('links')
@Controller('links')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new short link' })
  async create(@Body() dto: CreateLinkDto, @Req() req: Request) {
    const link = await this.links.create(dto);
    return {
      ...link,
      shortUrl: this.buildShortUrl(req, link.slug),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List links with filters + pagination' })
  findAll(@Query() query: QueryLinksDto) {
    return this.links.findAll(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single link with click totals' })
  async findOne(@Param('slug') slug: string, @Req() req: Request) {
    const link = await this.links.findOneBySlug(slug);
    return { ...link, shortUrl: this.buildShortUrl(req, link.slug) };
  }

  @Patch(':slug')
  @ApiOperation({ summary: 'Update destination, title, tags, or expiry' })
  update(@Param('slug') slug: string, @Body() dto: UpdateLinkDto) {
    return this.links.update(slug, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a link and its clicks' })
  async remove(@Param('slug') slug: string) {
    await this.links.remove(slug);
  }

  private buildShortUrl(req: Request, slug: string): string {
    const proto = (req.headers['x-forwarded-proto'] as string) ?? req.protocol;
    const host = req.get('host');
    return `${proto}://${host}/r/${slug}`;
  }
}
