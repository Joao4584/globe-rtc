import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UlidService } from '@/shared/ulid/ulid.service';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { AppErrors } from '@/presentation/errors';

const ROOM_PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class CreateRoomUseCase {
  constructor(
    private readonly roomsRepository: RoomTypeOrmRepository,
    private readonly ulidService: UlidService,
    private readonly mapTemplateRepository: MapTemplateTypeOrmRepository,
  ) {}
  async execute(data: { name: string; description?: string; owner_id: number; is_public: boolean; password?: string; map_template_public_id?: string }) {
    const public_id = this.ulidService.generateId();
    const password = data.password;

    if (data.is_public === false && (!password || password.trim().length === 0)) {
      throw AppErrors.badRequest('Private rooms must include a password');
    }

    const hashedPassword = data.is_public ? null : await bcrypt.hash(password!, ROOM_PASSWORD_SALT_ROUNDS);

    let map_template_id: number | null = null;
    if (data.map_template_public_id) {
      const template = await this.mapTemplateRepository.findByPublicId(data.map_template_public_id);
      if (!template) {
        throw AppErrors.notFound('Template de mapa nao encontrado');
      }
      if (template.user_id !== data.owner_id) {
        throw AppErrors.forbidden('Voce nao pode usar este template');
      }
      map_template_id = template.id;
    }

    return await this.roomsRepository.create({
      name: data.name,
      description: data.description,
      owner_id: data.owner_id,
      is_public: data.is_public,
      map_template_id,
      public_id,
      password: hashedPassword,
    });
  }
}
