import { loadCatalog, partsFor } from "./catalog";
import { createRng, newSeed, pick } from "./random";
import { SKIN_PARTS, SkinGeneratorError, SkinPart, SkinSeed, SkinSelection, SkinSourceOptions, SkinType } from "./types";

export interface RandomizeSkinOptions extends SkinSourceOptions {
  /** Which parts to roll again. Parts that do not exist for the type (kid accessory) are ignored. */
  parts: SkinPart[];
  /** The skin being edited. Parts that are not randomized keep the value from here. */
  current?: Partial<SkinSelection>;
  /** Defaults to `current.type`, then to "adult". Changing the type rolls every part: pieces are not shared between types. */
  type?: SkinType;
  /** Defaults to a fresh random seed. The same seed and inputs always give the same skin. */
  seed?: SkinSeed;
}

export interface RandomizeSkinResult {
  selection: SkinSelection;
  seed: SkinSeed;
}

export async function randomizeSkin(options: RandomizeSkinOptions): Promise<RandomizeSkinResult> {
  for (const part of options.parts) {
    if (!SKIN_PARTS.includes(part)) throw new SkinGeneratorError(`Unknown skin part "${part}". Use one of: ${SKIN_PARTS.join(", ")}.`);
  }

  const catalog = await loadCatalog(options);
  const type = options.type ?? options.current?.type ?? "adult";
  const typeChanged = options.current?.type !== undefined && options.current.type !== type;
  const current: Partial<SkinSelection> = typeChanged ? {} : options.current ?? {};
  const available = partsFor(type);
  const rolled = new Set<SkinPart>(typeChanged ? available : options.parts);

  const seed = options.seed ?? newSeed();
  const rng = createRng(seed);

  const selection: SkinSelection = { type, body: "", eyes: "", outfit: "", hairstyle: null, accessory: null };
  for (const part of available) {
    const ids = catalog[type][part] as string[];
    let value: string | null;
    if (rolled.has(part)) {
      value = pick(ids, rng);
    } else if (current[part] !== undefined) {
      value = current[part] as string | null;
    } else {
      // Not rolled and not provided: first piece, and no accessory.
      value = part === "accessory" ? null : ids[0];
    }
    (selection as unknown as Record<string, string | null>)[part] = value;
  }

  // Pajamas include their own hood, so they never get a hairstyle.
  if (selection.outfit.includes("pajama")) selection.hairstyle = null;

  return { selection, seed };
}
