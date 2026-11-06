import { promises as fs } from "fs";
import { PNG } from "pngjs";
import { Catalog, loadCatalog, partsFor, pieceFilePath, resolveSource } from "./catalog";
import { SkinGeneratorError, SkinPart, SkinSelection, SkinSize, SkinSourceOptions, SkinType } from "./types";

/** Directions in the order the pack draws them inside one animation. */
export const DIRECTIONS = ["right", "up", "left", "down"] as const;
export const FRAMES_PER_DIRECTION = 6;

/**
 * Rows of the spritesheet that are mapped (row 0 is the four standing poses). Each animation lists its directions in
 * drawing order and how many frames each direction has, so it has `directions.length * framesPerDirection` frames from
 * the left edge of its row. Verified frame by frame against the pack (see `.claude/docs/skin-generator.md`).
 * Not extracted yet: sleep, phone, push cart, pick up, gift, lift, stab, gun idle, grab gun, shoot, sit variation 2.
 */
export const ANIMATIONS = {
  idle: { row: 1, directions: DIRECTIONS, framesPerDirection: 6 },
  walk: { row: 2, directions: DIRECTIONS, framesPerDirection: 6 },
  /** Seated, side view only: right then left (the pack has no front or back sitting frames). */
  sit: { row: 4, directions: ["right", "left"], framesPerDirection: 6 },
  throw: { row: 12, directions: DIRECTIONS, framesPerDirection: 14 },
  punch: { row: 14, directions: DIRECTIONS, framesPerDirection: 6 },
  /** A short flash (white, then red) per direction. */
  hurt: { row: 19, directions: DIRECTIONS, framesPerDirection: 3 },
} as const satisfies Record<string, { row: number; directions: readonly string[]; framesPerDirection: number }>;

export type SkinAnimation = keyof typeof ANIMATIONS;

const framesOf = (name: SkinAnimation) => ANIMATIONS[name].directions.length * ANIMATIONS[name].framesPerDirection;

export interface AnimationLayout {
  frameWidth: number;
  frameHeight: number;
  /** Directions and frames per direction of the default animations (idle and walk); see `animations` for each one. */
  directions: readonly string[];
  framesPerDirection: number;
  /** `row` is the row inside the returned spritesheet (0 = first animation requested). */
  animations: { name: SkinAnimation; row: number; frames: number; directions: readonly string[]; framesPerDirection: number }[];
}

export interface RenderSkinOptions extends SkinSourceOptions {
  /** Also encode the whole spritesheet (every animation, with the pack's own label tags). Slower, so it is opt-in. */
  includeSpritesheet?: boolean;
  /**
   * Return a compact spritesheet with only these animations stacked top to bottom (24 frames wide each, no label
   * tags). Takes precedence over `includeSpritesheet`.
   */
  animations?: SkinAnimation[];
  /** Integer 1-8. Enlarges the preview with nearest-neighbor so the pixels stay sharp. The spritesheet is never scaled. Defaults to 1. */
  scale?: number;
}

export interface RenderedSkin {
  /** The four standing poses (right, up, left, down) side by side: `4 * size` wide, `size * 2` tall. PNG. */
  preview: Buffer;
  /** The spritesheet, PNG: only the requested `animations`, or the whole sheet with `includeSpritesheet`. */
  spritesheet?: Buffer;
  /** How to read `spritesheet` when `animations` was requested. */
  animationLayout?: AnimationLayout;
  size: SkinSize;
  frameWidth: number;
  frameHeight: number;
}

/** Bottom layer first. */
const LAYER_ORDER: SkinPart[] = ["body", "eyes", "outfit", "hairstyle", "accessory"];

const PREVIEW_FRAMES = 4;
const MAX_SCALE = 8;

/** Spritesheet grid: frames are `size` wide and `size * 2` tall; adults have 56x20 frames, kids 24x4. */
export function sheetLayout(type: SkinType, size: SkinSize) {
  const columns = type === "adult" ? 56 : 24;
  const rows = type === "adult" ? 20 : 4;
  return { frameWidth: size, frameHeight: size * 2, width: columns * size, height: rows * size * 2 };
}

export async function renderSkin(selection: SkinSelection, options: RenderSkinOptions = {}): Promise<RenderedSkin> {
  const { size, assetsDir } = resolveSource(options);
  const scale = options.scale ?? 1;
  if (!Number.isInteger(scale) || scale < 1 || scale > MAX_SCALE) {
    throw new SkinGeneratorError(`"scale" must be an integer from 1 to ${MAX_SCALE}.`);
  }
  const animations = options.animations;
  for (const name of animations ?? []) {
    if (!(name in ANIMATIONS)) {
      throw new SkinGeneratorError(`Unknown animation "${String(name)}". Use one of: ${Object.keys(ANIMATIONS).join(", ")}.`);
    }
  }
  const catalog = await loadCatalog(options);
  validateSelection(selection, catalog);

  const layout = sheetLayout(selection.type, size);
  const sheet = new PNG({ width: layout.width, height: layout.height });
  for (const part of LAYER_ORDER) {
    const id = selection[part];
    if (id === null) continue;
    const file = await fs.readFile(pieceFilePath(assetsDir, size, selection.type, part, id));
    blit(sheet, PNG.sync.read(file));
  }

  const preview = upscale(crop(sheet, PREVIEW_FRAMES * layout.frameWidth, layout.frameHeight), scale);

  let spritesheet: Buffer | undefined;
  let animationLayout: AnimationLayout | undefined;
  if (animations?.length) {
    spritesheet = PNG.sync.write(stackAnimations(sheet, animations, layout.frameWidth, layout.frameHeight));
    animationLayout = {
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
      directions: DIRECTIONS,
      framesPerDirection: FRAMES_PER_DIRECTION,
      animations: animations.map((name, row) => ({
        name,
        row,
        frames: framesOf(name),
        directions: ANIMATIONS[name].directions,
        framesPerDirection: ANIMATIONS[name].framesPerDirection,
      })),
    };
  } else if (options.includeSpritesheet) {
    spritesheet = PNG.sync.write(sheet);
  }

  return {
    preview: PNG.sync.write(preview),
    spritesheet,
    animationLayout,
    size,
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
  };
}

function validateSelection(selection: SkinSelection, catalog: Catalog): void {
  const available = partsFor(selection.type);
  for (const part of available) {
    const id = selection[part];
    const optional = part === "hairstyle" || part === "accessory";
    if (id === null && optional) continue;
    if (typeof id !== "string" || !(catalog[selection.type][part] as string[]).includes(id)) {
      throw new SkinGeneratorError(`Unknown ${selection.type} ${part} piece "${String(id)}".`);
    }
  }
  if (selection.type === "kid" && selection.accessory !== null) {
    throw new SkinGeneratorError("Kid skins have no accessories.");
  }
}

/** Source-over blend of `layer` onto `canvas` at (0, 0); anything outside the canvas is clipped. */
function blit(canvas: PNG, layer: PNG): void {
  const width = Math.min(canvas.width, layer.width);
  const height = Math.min(canvas.height, layer.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * layer.width + x) * 4;
      const srcAlpha = layer.data[src + 3];
      if (srcAlpha === 0) continue;
      const dst = (y * canvas.width + x) * 4;
      if (srcAlpha === 255) {
        canvas.data[dst] = layer.data[src];
        canvas.data[dst + 1] = layer.data[src + 1];
        canvas.data[dst + 2] = layer.data[src + 2];
        canvas.data[dst + 3] = 255;
        continue;
      }
      const sa = srcAlpha / 255;
      const da = canvas.data[dst + 3] / 255;
      const outAlpha = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) {
        canvas.data[dst + c] = Math.round((layer.data[src + c] * sa + canvas.data[dst + c] * da * (1 - sa)) / outAlpha);
      }
      canvas.data[dst + 3] = Math.round(outAlpha * 255);
    }
  }
}

/** Copies the frames of each requested row, one under the other. Anything to the right (label tags, props) is left out. */
function stackAnimations(sheet: PNG, animations: SkinAnimation[], frameWidth: number, frameHeight: number): PNG {
  const width = Math.max(...animations.map(framesOf)) * frameWidth;
  const out = new PNG({ width, height: animations.length * frameHeight });
  animations.forEach((name, index) => {
    const copyWidth = framesOf(name) * frameWidth;
    for (let y = 0; y < frameHeight; y++) {
      const from = (ANIMATIONS[name].row * frameHeight + y) * sheet.width * 4;
      sheet.data.copy(out.data, (index * frameHeight + y) * width * 4, from, from + copyWidth * 4);
    }
  });
  return out;
}

/** Top-left crop of `source`. */
function crop(source: PNG, width: number, height: number): PNG {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    source.data.copy(out.data, y * width * 4, y * source.width * 4, (y * source.width + width) * 4);
  }
  return out;
}

/** Nearest-neighbor enlargement by an integer factor. */
function upscale(source: PNG, scale: number): PNG {
  if (scale === 1) return source;
  const out = new PNG({ width: source.width * scale, height: source.height * scale });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const src = (Math.floor(y / scale) * source.width + Math.floor(x / scale)) * 4;
      source.data.copy(out.data, (y * out.width + x) * 4, src, src + 4);
    }
  }
  return out;
}
