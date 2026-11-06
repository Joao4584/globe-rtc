import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '@/infrastructure/entities/room.entity';
import { RoomParticipant } from '@/infrastructure/entities/room-participant.entity';
import { User } from '@/infrastructure/entities/user.entity';
import { Friends } from '@/infrastructure/entities/friends.entity';
import { RoomFavorite } from '@/infrastructure/entities/room-favorite.entity';
import { UploadFile } from '@/infrastructure/entities/upload-file.entity';
import { SupportRequest } from '@/infrastructure/entities/support-request.entity';
import { MapTemplate } from '@/infrastructure/entities/map-template.entity';
import { UserSkin } from '@/infrastructure/entities/user-skin.entity';
import { env } from '@globe-rtc/env';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: env.DB_HOST,
      port: Number(env.DB_PORT),
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      extra: {
        options: `-c timezone=${env.DB_TIMEZONE}`,
      },
      entities: [User, Room, RoomParticipant, RoomFavorite, Friends, UploadFile, SupportRequest, MapTemplate, UserSkin],
      synchronize: false,
    }),
  ],
  exports: [TypeOrmModule],
})
export class TypeOrmConfigModule {}
