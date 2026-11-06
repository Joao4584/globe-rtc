import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyRoomAccessTokenRequest {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1, { message: 'O token de acesso do quarto e obrigatorio.' })
  accessToken: string;
}
