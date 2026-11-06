import { Injectable } from '@nestjs/common';
import { UlidService } from '@/shared/ulid/ulid.service';
import { MapTemplateTypeOrmRepository } from '@/infrastructure/repositories/map-template.repository';
import { toMapTemplateItem } from '../map-template.mapper';

@Injectable()
export class CreateMapTemplateUseCase {
  constructor(
    private readonly mapTemplateRepository: MapTemplateTypeOrmRepository,
    private readonly ulidService: UlidService,
  ) {}

  async execute(user_id: number, name: string) {
    const template = await this.mapTemplateRepository.create({
      public_id: this.ulidService.generateId(),
      user_id,
      name: name.trim(),
    });

    return toMapTemplateItem(template);
  }
}
