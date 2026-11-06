import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserRequest {
  @ApiProperty()
  @IsEmail({}, { message: 'The `email` field must be a valid email.' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: 'The password must be at least 6 characters long.' })
  password: string;
}
