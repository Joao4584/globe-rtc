import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UlidModule } from '@/shared/ulid/ulid.module';
import { MapTemplate } from '@/infrastructure/entities/map-template.entity';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { CreateMapTemplateUseCase } from '@/application/map-template/use-case/create-map-template.use-case';
import { ListMapTemplatesUseCase } from '@/application/map-template/use-case/list-map-templates.use-case';
import { GetMapTemplateUseCase } from '@/application/map-template/use-case/get-map-template.use-case';
import { DeleteMapTemplateUseCase } from '@/application/map-template/use-case/delete-map-template.use-case';
import { UpdateMapTemplateUseCase } from '@/application/map-template/use-case/update-map-template.use-case';
import { MapTemplateController } from '@/presentation/controllers/map-template/map-template.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MapTemplate]), UlidModule],
  providers: [
    MapTemplateTypeOrmRepository,
    CreateMapTemplateUseCase,
    ListMapTemplatesUseCase,
    GetMapTemplateUseCase,
    UpdateMapTemplateUseCase,
    DeleteMapTemplateUseCase,
  ],
  controllers: [MapTemplateController],
})
export class MapTemplateModule {}
