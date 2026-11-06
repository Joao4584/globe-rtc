import { randomizeSkin, RandomizeSkinOptions } from "./randomize";
import { renderSkin, RenderedSkin, RenderSkinOptions } from "./render";
import { SkinSeed, SkinSelection } from "./types";

export * from "./types";
export { loadCatalog, partsFor, DEFAULT_SIZE } from "./catalog";
export type { Catalog } from "./catalog";
export { randomizeSkin } from "./randomize";
export type { RandomizeSkinOptions, RandomizeSkinResult } from "./randomize";
export { renderSkin, sheetLayout, ANIMATIONS, DIRECTIONS, FRAMES_PER_DIRECTION } from "./render";
export type { RenderedSkin, RenderSkinOptions, SkinAnimation, AnimationLayout } from "./render";

export interface GenerateSkinOptions extends RandomizeSkinOptions, RenderSkinOptions {}

export interface GeneratedSkin extends RenderedSkin {
  selection: SkinSelection;
  seed: SkinSeed;
}

/** Rolls the requested parts and renders the result: what a "Randomize" click does. */
export async function generateSkin(options: GenerateSkinOptions): Promise<GeneratedSkin> {
  const { selection, seed } = await randomizeSkin(options);
  const rendered = await renderSkin(selection, options);
  return { ...rendered, selection, seed };
}
