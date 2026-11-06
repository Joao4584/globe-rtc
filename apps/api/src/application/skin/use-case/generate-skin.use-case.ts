import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { AnimationLayout, generateSkin, SkinAnimation, SkinGeneratorError, SkinPart, SkinSelection, SkinType } from '@globe-rtc/skin-generator';
import { AppErrors } from '@/presentation/errors';

/** The preview is always returned at its real size (1x); the front scales it. */
const SKIN_SCALE = 1;
/** The animations that go into the spritesheet when `sheet=true` and none are asked for: all of them, in this row order. */
const DEFAULT_SHEET_ANIMATIONS: SkinAnimation[] = ['idle', 'walk', 'sit', 'throw', 'punch', 'hurt'];
/** Every request rolls with a fresh 4-digit seed (1000-9999). */
const SEED_MIN = 1000;
const SEED_MAX = 9999;

export interface GenerateSkinInput {
  type: SkinType;
  /** Parts to roll again. */
  parts: SkinPart[];
  /** Pieces to keep as they are for the parts that are not rolled. */
  current?: Partial<SkinSelection>;
  /** Returns the spritesheet. */
  includeSpritesheet: boolean;
  /** Which animations go into the spritesheet, top to bottom. Defaults to all six. Names are validated by the skin package. */
  animations?: SkinAnimation[];
}

export interface GenerateSkinOutput {
  seed: string | number;
  selection: SkinSelection;
  preview: Buffer;
  spritesheet?: Buffer;
  /** How to read `spritesheet` (frame size, directions, rows). Only with the spritesheet. */
  animationLayout?: AnimationLayout;
}

@Injectable()
export class GenerateSkinUseCase {
  async execute(input: GenerateSkinInput): Promise<GenerateSkinOutput> {
    try {
      const skin = await generateSkin({
        type: input.type,
        parts: input.parts,
        current: input.current,
        seed: randomInt(SEED_MIN, SEED_MAX + 1),
        animations: input.includeSpritesheet ? (input.animations?.length ? input.animations : DEFAULT_SHEET_ANIMATIONS) : undefined,
        scale: SKIN_SCALE,
      });
      return {
        seed: skin.seed,
        selection: skin.selection,
        preview: skin.preview,
        spritesheet: skin.spritesheet,
        animationLayout: skin.animationLayout,
      };
    } catch (error) {
      if (error instanceof SkinGeneratorError) {
        // Missing pieces is a server setup problem; anything else is a bad request.
        throw error.code === 'ASSETS_NOT_FOUND' ? AppErrors.internal(error.message) : AppErrors.badRequest(error.message);
      }
      throw error;
    }
  }
}
