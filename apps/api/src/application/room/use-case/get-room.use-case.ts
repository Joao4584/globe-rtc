import { Injectable } from '@nestjs/common';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { UploadFileTypeOrmRepository } from '@/infrastructure/repositories/upload-file.repository';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { RoomAccessService } from '../room-access.service';

@Injectable()
export class GetRoomUseCase {
  constructor(
    private readonly roomsRepository: RoomTypeOrmRepository,
    private readonly uploadFileRepository: UploadFileTypeOrmRepository,
    private readonly roomAccess: RoomAccessService,
    private readonly mapTemplateRepository: MapTemplateTypeOrmRepository,
  ) {}

  async execute(public_id: string, requesting_user_id?: number) {
    const room = await this.roomsRepository.findByPublicId(public_id);
    if (!room) {
      return null;
    }

    const my_role = requesting_user_id != null ? await this.roomAccess.getRole(room, requesting_user_id) : 'visitor';
    const is_owner = my_role === 'owner';

    const latestUpload = await this.uploadFileRepository.findLatestByRoomId(room.id);
    const roomResponse = { ...room } as Record<string, unknown>;
    delete roomResponse.id;
    delete roomResponse.map_template_id;
    delete roomResponse.owner_id;
    delete roomResponse.password;
    delete roomResponse.owner;

    // The map is what everyone in the room renders; private rooms only hand it to members.
    let map: Record<string, unknown> | null = null;
    if (room.map_template_id && (room.is_public || my_role !== 'visitor')) {
      const template = await this.mapTemplateRepository.findById(room.map_template_id);
      map = template?.data ?? null;
    }

    return {
      ...roomResponse,
      map,
      is_owner,
      my_role,
      can_edit: this.roomAccess.canEdit(my_role),
      url_image: latestUpload ? `/upload/room/${room.public_id}/file` : null,
    };
  }
}
