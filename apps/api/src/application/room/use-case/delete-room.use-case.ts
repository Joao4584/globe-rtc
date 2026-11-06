import { Injectable } from '@nestjs/common';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { AppErrors } from '@/presentation/errors';

@Injectable()
export class DeleteRoomUseCase {
  constructor(private readonly roomsRepository: RoomTypeOrmRepository) {}
  async execute(public_id: string, requesting_user_id: number) {
    const room = await this.roomsRepository.findByPublicId(public_id);
    if (!room) {
      throw AppErrors.notFound('Quarto não encontrado');
    }
    if (room.owner_id !== requesting_user_id) {
      throw AppErrors.forbidden('Você não tem permissão para excluir este quarto');
    }

    await this.roomsRepository.deleteByPublicId(public_id);
  }
}
