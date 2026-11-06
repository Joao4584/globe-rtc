import { MapTemplate } from '@/infrastructure/entities/map-template.entity';

export function toMapTemplateItem(template: MapTemplate) {
  return {
    public_id: template.public_id,
    name: template.name,
    created_at: template.created_at,
    updated_at: template.updated_at,
  };
}
