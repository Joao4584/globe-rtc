import { Module } from '@nestjs/common';
import { GenerateSkinUseCase } from '@/application/skin/use-case/generate-skin.use-case';
import { RenderSkinUseCase } from '@/application/skin/use-case/render-skin.use-case';
import { SkinCatalogUseCase } from '@/application/skin/use-case/skin-catalog.use-case';
import { SkinCharacterController } from '@/presentation/controllers/skin/skin-character.controller';
import { GenerateSkinController } from '@/presentation/controllers/skin/generate-skin.controller';

@Module({
  providers: [GenerateSkinUseCase, RenderSkinUseCase, SkinCatalogUseCase],
  controllers: [GenerateSkinController, SkinCharacterController],
})
export class SkinModule {}
