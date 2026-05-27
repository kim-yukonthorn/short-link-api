import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({
    description: 'Destination URL the short link redirects to',
    example: 'https://www.google.com',
  })
  @IsUrl({ require_protocol: true })
  destination!: string;

  @ApiPropertyOptional({
    description:
      'Custom slug (3-32 chars, alphanumeric + dash/underscore). Auto-generated if omitted.',
    example: 'my-link',
  })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'slug must contain only letters, numbers, dashes, and underscores',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'Google homepage' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ type: [String], example: ['search', 'work'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'ISO 8601 expiry datetime',
    example: '2026-12-31T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
