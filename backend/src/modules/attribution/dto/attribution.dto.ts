import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAttributionDto {
  @Type(() => Number)
  @IsInt()
  eventId: number;
}
