import { IsString, IsOptional, MinLength, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoomRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'O nome do quarto deve ter pelo menos 3 caracteres.' })
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  public?: boolean;

  @ApiPropertyOptional({ description: 'Required when the room becomes private; ignored for public rooms', minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha do quarto deve ter pelo menos 6 caracteres.' })
  password?: string;
}
