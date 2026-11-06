import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, MinLength, Max, Min } from 'class-validator';

export class CreateSupportRequest {
  @ApiProperty({ example: 'Nao consigo entrar no quarto do planning' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject: string;

  @ApiProperty({
    example: 'Quando clico no convite do quarto, volta para o dashboard sem mensagem.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
