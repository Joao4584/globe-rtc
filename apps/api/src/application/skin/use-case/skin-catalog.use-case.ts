import { Injectable } from '@nestjs/common';
import { loadCatalog, partsFor, SkinGeneratorError, SkinPart, SkinType } from '@globe-rtc/skin-generator';
import { AppErrors } from '@/presentation/errors';

/** Pieces of the same style in their colour variants. `variants` are piece ids, in the pack's order. */
export interface SkinStyleGroup {
  style: string;
  variants: string[];
}

export type SkinCatalogOutput = Record<SkinType, Partial<Record<SkinPart, SkinStyleGroup[]>>>;

// Piece ids look like `Hairstyle_01_32x32_03` (style `Hairstyle_01`, colour 03) or `Outfit_kid_1_32x32` (no colour).
const VARIANT_ID = /^(.*)_32x32_(\d+)$/;
const styleOf = (id: string) => VARIANT_ID.exec(id)?.[1] ?? id.replace(/_32x32$/, '');

@Injectable()
export class SkinCatalogUseCase {
  async execute(): Promise<SkinCatalogOutput> {
    try {
      const catalog = await loadCatalog();
      const result: SkinCatalogOutput = { adult: {}, kid: {} };
      for (const type of ['adult', 'kid'] as SkinType[]) {
        for (const part of partsFor(type)) {
          const groups = new Map<string, string[]>();
          for (const id of catalog[type][part] ?? []) {
            const style = styleOf(id);
            groups.set(style, [...(groups.get(style) ?? []), id]);
          }
          result[type][part] = [...groups].map(([style, variants]) => ({ style, variants }));
        }
      }
      return result;
    } catch (error) {
      if (error instanceof SkinGeneratorError) throw AppErrors.internal(error.message);
      throw error;
    }
  }
}
