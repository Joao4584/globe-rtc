import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '@globe-rtc/env';
import { User } from './src/infrastructure/entities/user.entity';
import { Room } from './src/infrastructure/entities/room.entity';
import { RoomParticipant } from './src/infrastructure/entities/room-participant.entity';
import { Friends } from './src/infrastructure/entities/friends.entity';
import { RoomFavorite } from './src/infrastructure/entities/room-favorite.entity';
import { UploadFile } from './src/infrastructure/entities/upload-file.entity';
import { SupportRequest } from './src/infrastructure/entities/support-request.entity';
import { MapTemplate } from './src/infrastructure/entities/map-template.entity';

export default new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  extra: {
    options: `-c timezone=${env.DB_TIMEZONE}`,
  },
  entities: [
    User,
    Room,
    RoomParticipant,
    RoomFavorite,
    Friends,
    UploadFile,
    SupportRequest,
    MapTemplate,
  ],
  migrations: ['./src/infrastructure/migrations/*.ts'],
  synchronize: false,
});
