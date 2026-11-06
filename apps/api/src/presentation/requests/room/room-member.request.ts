import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddRoomMemberRequest {
  @ApiProperty({ description: 'Public id of the friend to add' })
  @IsString()
  user_public_id: string;

  @ApiPropertyOptional({ enum: ['member', 'admin'] })
  @IsOptional()
  @IsIn(['member', 'admin'])
  role?: 'member' | 'admin';
}

export class UpdateRoomMemberRequest {
  @ApiProperty({ enum: ['member', 'admin'] })
  @IsIn(['member', 'admin'])
  role: 'member' | 'admin';
}
