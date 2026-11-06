import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '@/infrastructure/entities/room.entity';
import { RoomParticipant } from '@/infrastructure/entities/room-participant.entity';
import { RoomFavorite } from '@/infrastructure/entities/room-favorite.entity';
import { RoomTypeOrmRepository } from '@/infrastructure/repositories/room.repository';
import { RoomParticipantTypeOrmRepository } from '@/infrastructure/repositories/room-participant.repository';
import { RoomFavoriteTypeOrmRepository } from '@/infrastructure/repositories/room-favorite.repository';
import { CreateRoomUseCase } from './use-case/create-room.use-case';
import { GetRoomUseCase } from './use-case/get-room.use-case';
import { DeleteRoomUseCase } from './use-case/delete-room.use-case';
import { ListUserRoomsUseCase } from './use-case/list-user-rooms.use-case';
import { GetUserRoomsUseCase } from './use-case/get-user-rooms.use-case';
import { JoinRoomUseCase } from './use-case/join-room.use-case';
import { ToggleRoomFavoriteUseCase } from './use-case/toggle-room-favorite.use-case';
import { RoomController } from '@/presentation/controllers/room/room.controller';
import { RoomParticipantsController } from '@/presentation/controllers/room/room-participants.controller';
import { UlidModule } from '@/shared/ulid/ulid.module';
import { UploadFile } from '@/infrastructure/entities/upload-file.entity';
import { UploadFileTypeOrmRepository } from '@/infrastructure/repositories/upload-file.repository';
import { VerifyRoomPasswordUseCase } from './use-case/verify-room-password.use-case';
import { Friends } from '@/infrastructure/entities/friends.entity';
import { FriendsTypeOrmRepository } from '@/infrastructure/repositories/friends.repository';
import { RoomAccessService } from './room-access.service';
import { UpdateRoomUseCase } from './use-case/update-room.use-case';
import { ManageRoomMembersUseCase } from './use-case/manage-room-members.use-case';
import { RoomMembersController } from '@/presentation/controllers/room/room-members.controller';
import { MapTemplate } from '@/infrastructure/entities/map-template.entity';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { UserModule } from '@/application/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Room, RoomParticipant, RoomFavorite, UploadFile, Friends, MapTemplate]), UlidModule, UserModule],
  providers: [
    RoomTypeOrmRepository,
    MapTemplateTypeOrmRepository,
    RoomParticipantTypeOrmRepository,
    RoomFavoriteTypeOrmRepository,
    UploadFileTypeOrmRepository,
    FriendsTypeOrmRepository,
    RoomAccessService,
    UpdateRoomUseCase,
    ManageRoomMembersUseCase,
    VerifyRoomPasswordUseCase,
    CreateRoomUseCase,
    GetRoomUseCase,
    DeleteRoomUseCase,
    ListUserRoomsUseCase,
    GetUserRoomsUseCase,
    JoinRoomUseCase,
    ToggleRoomFavoriteUseCase,
  ],
  controllers: [RoomController, RoomParticipantsController, RoomMembersController],
})
export class RoomModule {}
