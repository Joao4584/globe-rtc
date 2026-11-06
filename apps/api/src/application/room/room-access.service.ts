import { Injectable } from '@nestjs/common';
import { Room } from '@/infrastructure/entities/room.entity';
import { RoomParticipantTypeOrmRepository } from '@/infrastructure/repositories/room-participant.repository';

export type RoomAccessRole = 'owner' | 'admin' | 'member' | 'visitor';

@Injectable()
export class RoomAccessService {
  constructor(private readonly roomParticipantsRepository: RoomParticipantTypeOrmRepository) {}

  async getRole(room: Room, user_id: number): Promise<RoomAccessRole> {
    if (room.owner_id === user_id) return 'owner';
    const participant = await this.roomParticipantsRepository.findByRoomAndUser(room.id, user_id);
    if (participant?.role === 'admin' || participant?.role === 'member') return participant.role;
    return 'visitor';
  }

  canEdit(role: RoomAccessRole) {
    return role === 'owner' || role === 'admin';
  }
}
