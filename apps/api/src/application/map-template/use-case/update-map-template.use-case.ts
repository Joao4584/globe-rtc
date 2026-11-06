import { Injectable } from '@nestjs/common';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { AppErrors } from '@/presentation/errors';
import { toMapTemplateItem } from '../map-template.mapper';
import { validateMapData } from '../map-data.validator';

@Injectable()
export class UpdateMapTemplateUseCase {
  constructor(private readonly mapTemplateRepository: MapTemplateTypeOrmRepository) {}

  // Overwrites the template's map (last write wins, no history).
  async execute(user_id: number, public_id: string, data: Record<string, unknown>) {
    const template = await this.mapTemplateRepository.findByPublicId(public_id);
    if (!template) {
      throw AppErrors.notFound('Template nao encontrado');
    }

    if (template.user_id !== user_id) {
      throw AppErrors.forbidden('Voce nao pode alterar este template');
    }

    validateMapData(data);
    const saved = await this.mapTemplateRepository.updateData(template, data);
    return { ...toMapTemplateItem(saved), data: saved.data };
  }
}
