import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MapTemplate } from '@/infrastructure/entities/map-template.entity';

export interface CreateMapTemplateInput {
  public_id: string;
  user_id: number;
  name: string;
}

@Injectable()
export class MapTemplateTypeOrmRepository {
  constructor(
    @InjectRepository(MapTemplate)
    private readonly repository: Repository<MapTemplate>,
  ) {}

  async create(data: CreateMapTemplateInput): Promise<MapTemplate> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async findByUserId(user_id: number, sort: 'recent' | 'alphabetical'): Promise<MapTemplate[]> {
    return await this.repository.find({
      where: { user_id },
      order: sort === 'alphabetical' ? { name: 'ASC' } : { updated_at: 'DESC' },
    });
  }

  async findById(id: number): Promise<MapTemplate | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findByPublicId(public_id: string): Promise<MapTemplate | null> {
    return await this.repository.findOne({ where: { public_id } });
  }

  async updateData(template: MapTemplate, data: Record<string, unknown>): Promise<MapTemplate> {
    template.data = data;
    return await this.repository.save(template);
  }

  async softDeleteById(id: number): Promise<void> {
    await this.repository.softDelete(id);
  }
}
