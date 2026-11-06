import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateMapTemplateRequest {
  @ApiProperty({ description: 'Mapa no formato v3 do editor (ver .claude/docs/map-format.md)', type: Object })
  @IsObject()
  data: Record<string, unknown>;
}
