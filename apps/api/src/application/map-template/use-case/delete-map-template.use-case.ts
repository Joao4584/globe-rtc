import { Injectable } from '@nestjs/common';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { AppErrors } from '@/presentation/errors';

@Injectable()
export class DeleteMapTemplateUseCase {
  constructor(private readonly mapTemplateRepository: MapTemplateTypeOrmRepository) {}

  async execute(user_id: number, public_id: string) {
    const template = await this.mapTemplateRepository.findByPublicId(public_id);
    if (!template) {
      throw AppErrors.notFound('Template nao encontrado');
    }

    if (template.user_id !== user_id) {
      throw AppErrors.forbidden('Voce nao pode remover este template');
    }

    await this.mapTemplateRepository.softDeleteById(template.id);
  }
}
