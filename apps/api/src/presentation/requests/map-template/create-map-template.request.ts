import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMapTemplateRequest {
  @ApiProperty({ example: 'Escritorio com 3 salas' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;
}
