import { promises as fs } from "fs";
import path from "path";
import { SKIN_PARTS, SkinGeneratorError, SkinPart, SkinSize, SkinSourceOptions, SkinType } from "./types";

/** Folder (inside `<assets>/<size>x<size>/`) that holds each part, per skin type. Kids have no accessories. */
const PART_FOLDERS: Record<SkinType, Partial<Record<SkinPart, string>>> = {
  adult: { body: "Bodies", eyes: "Eyes", outfit: "Outfits", hairstyle: "Hairstyles", accessory: "Accessories" },
  kid: { body: "Bodies_kids", eyes: "Eyes_kids", outfit: "Outfits_kids", hairstyle: "Hairstyles_kids" },
};

export type Catalog = Record<SkinType, Partial<Record<SkinPart, string[]>>>;

export const DEFAULT_SIZE: SkinSize = 32;

/**
 * `packages/skin-generator/private-assets`. `__dirname` is `packages/skin-generator/dist` (or `src`), so the package
 * root is one level up. The folder is git-ignored on purpose: the pieces are licensed art that cannot be redistributed.
 */
const DEFAULT_ASSETS_DIR = path.join(__dirname, "..", "private-assets");

export function partsFor(type: SkinType): SkinPart[] {
  return SKIN_PARTS.filter((part) => PART_FOLDERS[type][part] !== undefined);
}

export function resolveSource(options: SkinSourceOptions): { size: SkinSize; assetsDir: string } {
  return {
    size: options.size ?? DEFAULT_SIZE,
    assetsDir: path.resolve(options.assetsDir ?? process.env.SKIN_GENERATOR_ASSETS_DIR ?? DEFAULT_ASSETS_DIR),
  };
}

export function pieceFilePath(assetsDir: string, size: SkinSize, type: SkinType, part: SkinPart, id: string): string {
  return path.join(assetsDir, `${size}x${size}`, PART_FOLDERS[type][part] as string, `${id}.png`);
}

const cache = new Map<string, Promise<Catalog>>();

/** Lists the available piece ids by scanning the assets folder. Cached per assets folder and size. */
export function loadCatalog(options: SkinSourceOptions = {}): Promise<Catalog> {
  const { size, assetsDir } = resolveSource(options);
  const key = `${assetsDir}|${size}`;
  let catalog = cache.get(key);
  if (!catalog) {
    catalog = scan(assetsDir, size);
    // Do not cache failures: the assets may be synced later while the process is running.
    catalog.catch(() => cache.delete(key));
    cache.set(key, catalog);
  }
  return catalog;
}

async function scan(assetsDir: string, size: SkinSize): Promise<Catalog> {
  const catalog: Catalog = { adult: {}, kid: {} };
  for (const type of Object.keys(PART_FOLDERS) as SkinType[]) {
    for (const part of partsFor(type)) {
      const folder = path.join(assetsDir, `${size}x${size}`, PART_FOLDERS[type][part] as string);
      let files: string[];
      try {
        files = await fs.readdir(folder);
      } catch {
        throw new SkinGeneratorError(
          `Skin pieces not found at "${folder}". Copy them from the Modern Interiors pack with ` +
            `"pnpm --filter @globe-rtc/skin-generator sync-assets -- --source <pack>/2_Characters/Character_Generator" ` +
            `or point SKIN_GENERATOR_ASSETS_DIR at an existing assets folder.`,
          "ASSETS_NOT_FOUND",
        );
      }
      const ids = files
        .filter((file) => file.toLowerCase().endsWith(".png"))
        .map((file) => file.slice(0, -".png".length))
        .sort();
      if (ids.length === 0) throw new SkinGeneratorError(`No .png pieces in "${folder}".`, "ASSETS_NOT_FOUND");
      catalog[type][part] = ids;
    }
  }
  return catalog;
}
