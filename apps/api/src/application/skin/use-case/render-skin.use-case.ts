import { Injectable } from '@nestjs/common';
import { AnimationLayout, renderSkin, SkinAnimation, SkinGeneratorError, SkinSelection } from '@globe-rtc/skin-generator';
import { AppErrors } from '@/presentation/errors';

/** Every row of the spritesheet, top to bottom. */
const ALL_ANIMATIONS: SkinAnimation[] = ['idle', 'walk', 'sit', 'throw', 'punch', 'hurt'];

export interface RenderSkinOutput {
  selection: SkinSelection;
  /** The complete spritesheet (PNG). */
  spritesheet: Buffer;
  /** How to read the spritesheet: frame size and, per animation, its row, directions and frames per direction. */
  layout: AnimationLayout;
}

@Injectable()
export class RenderSkinUseCase {
  /** Renders exactly this selection (already validated against the pack). */
  async execute(selection: SkinSelection): Promise<RenderSkinOutput> {
    try {
      const skin = await renderSkin(selection, { animations: ALL_ANIMATIONS, scale: 1 });
      return { selection, spritesheet: skin.spritesheet as Buffer, layout: skin.animationLayout as AnimationLayout };
    } catch (error) {
      if (error instanceof SkinGeneratorError) {
        throw error.code === 'ASSETS_NOT_FOUND' ? AppErrors.internal(error.message) : AppErrors.badRequest(error.message);
      }
      throw error;
    }
  }
}
