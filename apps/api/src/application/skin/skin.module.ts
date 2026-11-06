import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSkin } from '@/infrastructure/entities/user-skin.entity';
import { UserSkinUseCase } from '@/application/skin/use-case/user-skin.use-case';
import { GenerateSkinUseCase } from '@/application/skin/use-case/generate-skin.use-case';
import { RenderSkinUseCase } from '@/application/skin/use-case/render-skin.use-case';
import { SkinCatalogUseCase } from '@/application/skin/use-case/skin-catalog.use-case';
import { SkinCharacterController } from '@/presentation/controllers/skin/skin-character.controller';
import { GenerateSkinController } from '@/presentation/controllers/skin/generate-skin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserSkin])],
  providers: [GenerateSkinUseCase, RenderSkinUseCase, SkinCatalogUseCase, UserSkinUseCase],
  controllers: [GenerateSkinController, SkinCharacterController],
})
export class SkinModule {}
