import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLinkDto } from './create-link.dto';

// slug is immutable after creation to keep distributed short URLs stable.
export class UpdateLinkDto extends PartialType(
  OmitType(CreateLinkDto, ['slug'] as const),
) {}
