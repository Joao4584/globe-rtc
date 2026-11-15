import { Controller, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateVoiceTokenUseCase } from '@/application/room/use-case/create-voice-token.use-case';
import { User } from '@/presentation/decorators/user.decorator';
import { User as UserEntity } from '@/infrastructure/entities/user.entity';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('room/:room_public_id/voice-token')
export class RoomVoiceController {
  constructor(@Inject(CreateVoiceTokenUseCase) private readonly createVoiceToken: CreateVoiceTokenUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Get a LiveKit token for the proximity voice/video of a room' })
  @ApiParam({ name: 'room_public_id', description: 'Room public id' })
  async token(@Param('room_public_id') room_public_id: string, @User() user: UserEntity) {
    return await this.createVoiceToken.execute(room_public_id, user);
  }
}
