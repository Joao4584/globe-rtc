import { IsString, IsOptional, MinLength, IsIn, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface CreateRoomDto {
  name: string;
  description?: string;
  public: boolean;
  password?: string;
  map_template_id: string;
}

export class CreateRoomRequest implements CreateRoomDto {
  @ApiProperty()
  @IsString()
  @MinLength(3, {
    message: 'O nome do quarto deve ter pelo menos 3 caracteres.',
  })
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: Boolean })
  @Transform(({ value }) => {
    if (value === 1 || value === '1' || value === true) {
      return true;
    }
    return false;
  })
  @IsIn([0, 1, true, false])
  public: boolean;

  @ApiPropertyOptional({
    description: 'Required for private rooms',
    minLength: 6,
  })
  @ValidateIf((object: CreateRoomRequest) => object.public === false || object.password != null)
  @IsString()
  @MinLength(6, {
    message: 'A senha do quarto deve ter pelo menos 6 caracteres.',
  })
  password?: string;

  @ApiProperty({ description: 'Public id of the map template the room uses (must be yours)' })
  @IsString()
  map_template_id: string;
}
