import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { AppErrors } from '@/presentation/errors';
import { RoomAccessService } from '../room-access.service';

const ROOM_PASSWORD_SALT_ROUNDS = 12;

export type UpdateRoomInput = {
  name?: string;
  description?: string | null;
  public?: boolean;
  password?: string;
};

@Injectable()
export class UpdateRoomUseCase {
  constructor(
    private readonly roomsRepository: RoomTypeOrmRepository,
    private readonly roomAccess: RoomAccessService,
  ) {}

  async execute(public_id: string, user_id: number, data: UpdateRoomInput) {
    const room = await this.roomsRepository.findByPublicId(public_id);
    if (!room) throw AppErrors.notFound('Quarto não encontrado');

    const role = await this.roomAccess.getRole(room, user_id);
    if (!this.roomAccess.canEdit(role)) {
      throw AppErrors.forbidden('Você não tem permissão para editar este quarto');
    }

    const changes: Parameters<RoomTypeOrmRepository['update']>[1] = {};
    if (data.name !== undefined) changes.name = data.name.trim();
    if (data.description !== undefined) changes.description = data.description?.trim() || null;

    const nextIsPublic = data.public ?? room.is_public;
    if (nextIsPublic) {
      changes.is_public = true;
      changes.password = null;
    } else {
      if (data.password) {
        changes.password = await bcrypt.hash(data.password, ROOM_PASSWORD_SALT_ROUNDS);
      } else if (!room.password) {
        throw AppErrors.badRequest('Private rooms must include a password');
      }
      changes.is_public = false;
    }

    await this.roomsRepository.update(room.id, changes);
    return { updated: true };
  }
}
