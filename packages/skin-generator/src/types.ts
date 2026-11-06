export const SKIN_PARTS = ["body", "eyes", "outfit", "hairstyle", "accessory"] as const;

export type SkinPart = (typeof SKIN_PARTS)[number];

export type SkinType = "adult" | "kid";

/** Pixel size of the Modern Interiors variant: 16x16, 32x32 or 48x48 (each frame is `size` wide and `size * 2` tall). */
export type SkinSize = 16 | 32 | 48;

/** Where the pieces live and which variant to use. Shared by every public function. */
export interface SkinSourceOptions {
  /** Defaults to 32. */
  size?: SkinSize;
  /** Defaults to `SKIN_GENERATOR_ASSETS_DIR`, then to `<package>/assets`. */
  assetsDir?: string;
}

/** One piece id per part. The id is the piece file name without `.png`. `null` means "none". */
export interface SkinSelection {
  type: SkinType;
  body: string;
  eyes: string;
  outfit: string;
  hairstyle: string | null;
  /** Always `null` for kids: the pack has no kid accessories. */
  accessory: string | null;
}

export type SkinSeed = number | string;

/** `INVALID_INPUT`: the caller asked for something that does not exist. `ASSETS_NOT_FOUND`: the pieces are not installed. */
export type SkinGeneratorErrorCode = "INVALID_INPUT" | "ASSETS_NOT_FOUND";

export class SkinGeneratorError extends Error {
  constructor(
    message: string,
    readonly code: SkinGeneratorErrorCode = "INVALID_INPUT",
  ) {
    super(message);
    this.name = "SkinGeneratorError";
  }
}
