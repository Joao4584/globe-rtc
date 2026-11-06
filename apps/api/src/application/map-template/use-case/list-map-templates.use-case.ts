import { Injectable } from '@nestjs/common';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { toMapTemplateItem } from '../map-template.mapper';

@Injectable()
export class ListMapTemplatesUseCase {
  constructor(private readonly mapTemplateRepository: MapTemplateTypeOrmRepository) {}

  async execute(user_id: number, sort: 'recent' | 'alphabetical') {
    const templates = await this.mapTemplateRepository.findByUserId(user_id, sort);
    return templates.map(toMapTemplateItem);
  }
}
