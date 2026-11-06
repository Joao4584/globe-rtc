import { Module } from '@nestjs/common';
import { GenerateSkinUseCase } from '@/application/skin/use-case/generate-skin.use-case';
import { GenerateSkinController } from '@/presentation/controllers/skin/generate-skin.controller';

@Module({
  providers: [GenerateSkinUseCase],
  controllers: [GenerateSkinController],
})
export class SkinModule {}
