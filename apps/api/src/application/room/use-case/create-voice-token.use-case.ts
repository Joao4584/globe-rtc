import { Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { env } from '@globe-rtc/env';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { RoomParticipantTypeOrmRepository } from '@/infrastructure/repositories/room-participant.repository';
import { AppErrors } from '@/presentation/errors';

/** Issues a short-lived LiveKit token so a room participant can join the voice/video session of that room. */
@Injectable()
export class CreateVoiceTokenUseCase {
  constructor(
    private readonly roomsRepository: RoomTypeOrmRepository,
    private readonly roomParticipantsRepository: RoomParticipantTypeOrmRepository,
  ) {}

  async execute(room_public_id: string, user: { id: number; public_id: string; name: string }) {
    const room = await this.roomsRepository.findByPublicId(room_public_id);
    if (!room) throw AppErrors.notFound('Quarto nao encontrado');

    // Only people who joined the room (the web joins before loading the game) can talk in it.
    const participant = await this.roomParticipantsRepository.findByRoomAndUser(room.id, user.id);
    if (!participant) throw AppErrors.forbidden('Entre na sala antes de usar voz');

    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: user.public_id,
      name: user.name,
      ttl: '2h',
    });
    token.addGrant({
      room: room.public_id,
      roomJoin: true,
      canPublish: true,
      canPublishData: false,
      canSubscribe: true,
    });

    return { token: await token.toJwt(), url: env.LIVEKIT_URL };
  }
}
