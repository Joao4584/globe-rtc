import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const SkinTypes = ['adult', 'kid'] as const;
const SkinFormats = ['image', 'json'] as const;

/** Query string of `GET /skin/generate`. Everything is optional: with no params it rolls a whole adult skin. */
export class GenerateSkinRequest {
  @ApiPropertyOptional({ enum: SkinTypes, default: 'adult' })
  @IsOptional()
  @IsIn(SkinTypes, { message: 'The `type` field must be one of the following values: adult, kid.' })
  type?: (typeof SkinTypes)[number];

  @ApiPropertyOptional({
    description: 'Comma separated parts to randomize: body,eyes,outfit,hairstyle,accessory. Defaults to all of them.',
    example: 'outfit,hairstyle',
  })
  @IsOptional()
  @IsString({ message: 'The `parts` field must be a string.' })
  parts?: string;

  @ApiPropertyOptional({ description: 'Piece id to keep when `body` is not randomized.' })
  @IsOptional()
  @IsString({ message: 'The `body` field must be a string.' })
  body?: string;

  @ApiPropertyOptional({ description: 'Piece id to keep when `eyes` is not randomized.' })
  @IsOptional()
  @IsString({ message: 'The `eyes` field must be a string.' })
  eyes?: string;

  @ApiPropertyOptional({ description: 'Piece id to keep when `outfit` is not randomized.' })
  @IsOptional()
  @IsString({ message: 'The `outfit` field must be a string.' })
  outfit?: string;

  @ApiPropertyOptional({ description: 'Piece id to keep when `hairstyle` is not randomized. Use `none` for no hairstyle.' })
  @IsOptional()
  @IsString({ message: 'The `hairstyle` field must be a string.' })
  hairstyle?: string;

  @ApiPropertyOptional({ description: 'Piece id to keep when `accessory` is not randomized. Use `none` for no accessory.' })
  @IsOptional()
  @IsString({ message: 'The `accessory` field must be a string.' })
  accessory?: string;

  @ApiPropertyOptional({ enum: SkinFormats, default: 'image', description: '`image` returns the PNG itself, `json` returns data URLs plus the selection.' })
  @IsOptional()
  @IsIn(SkinFormats, { message: 'The `format` field must be one of the following values: image, json.' })
  format?: (typeof SkinFormats)[number];

  @ApiPropertyOptional({ enum: ['true', 'false'], default: 'false', description: 'Return the idle + walk spritesheet (24 frames each: 6 per direction, rows idle then walk) instead of the 4-pose preview.' })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'The `sheet` field must be true or false.' })
  sheet?: string;

  @ApiPropertyOptional({
    description: 'With `sheet=true`: comma separated animations to put in the spritesheet, one row each in this order: idle,walk,sit,throw,punch,hurt. Defaults to idle,walk.',
    example: 'idle,walk,sit,throw,punch,hurt',
  })
  @IsOptional()
  @IsString({ message: 'The `animations` field must be a string.' })
  animations?: string;
}
