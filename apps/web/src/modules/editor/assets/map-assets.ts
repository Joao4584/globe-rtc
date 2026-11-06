// Loads per-object art from the theme atlases (see .claude/docs/object-atlas.md) and cuts objects out of them into small
// canvases, so the palette (DOM) and the builder scene (Phaser) draw the same art. Walls, floors and borders are themes
// of the same atlas.

export const TILE = 32;

// object = one picture of the atlas; animated = an animated object (the editor shows its first frame); wall / floor / border = one 32px cell of the matching Room Builder sheet.
export type ItemKind = "object" | "animated" | SheetKind;
export type ItemLayer = "floor" | "wall" | "object";

// A drawable thing the creator can place. `offsetX/Y` is where the art starts inside its first tile cell.
export type MapItem = {
  kind: ItemKind;
  id: string;
  layer: ItemLayer;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  tilesW: number;
  tilesH: number;
  /** rows the art extends above the cell it is placed on (objects are anchored by their base) */
  cellDy: number;
  /** animated objects: every frame side by side (the canvas above is frame 0) */
  animation?: { strip: HTMLCanvasElement; frames: number; frameW: number; delays: number[] };
};

// What follows the mouse: items laid out in tile offsets from the cursor cell.
/** `flat`: placed as a rug, the players walk over it (drawn under them instead of sorted by Y). */
export type Brush = { items: { item: MapItem; dx: number; dy: number }[]; width: number; height: number; flat?: boolean };

export const itemKey = (item: Pick<MapItem, "kind" | "id">) => `${item.kind}:${item.id}`;

const jsonCache = new Map<string, Promise<unknown>>();
function loadJson<T>(url: string): Promise<T> {
  let cached = jsonCache.get(url);
  if (!cached) {
    cached = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${url}`);
      return response.json();
    });
    jsonCache.set(url, cached);
  }
  return cached as Promise<T>;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  let cached = imageCache.get(url);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${url}`));
      image.src = url;
    });
    imageCache.set(url, cached);
  }
  return cached;
}


function newCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const itemCache = new Map<string, Promise<MapItem>>();

export function getItem(kind: ItemKind, id: string): Promise<MapItem> {
  if (kind === "object") return getObjectItem(id);
  if (kind === "animated") return getAnimatedItem(id);
  if (kind === "wall" || kind === "floor" || kind === "border") return getSheetTileItem(kind, id);
  return Promise.reject(new Error(`Unknown item kind ${kind}`));
}

// ---- per-object art (atlas built by scripts/assets/build-object-atlas.mjs, see .claude/docs/object-atlas.md) ----
const OBJECT_ATLAS_DIR = "/tiles/atlas/objects";

export type ObjectThemeInfo = { name: string; label: string; count: number; pages: number; manifest: string };
export type ObjectEntry = { id: string; n: number; page: number; x: number; y: number; w: number; h: number };
export type ObjectThemeManifest = { theme: string; pages: { file: string; width: number; height: number }[]; objects: ObjectEntry[] };

export const objectPageUrl = (file: string) => `${OBJECT_ATLAS_DIR}/${file}`;
export const loadObjectThemes = () => loadJson<{ themes: ObjectThemeInfo[] }>(`${OBJECT_ATLAS_DIR}/index.json`).then((index) => index.themes);
// Only the themes a map uses are downloaded.
export const loadObjectTheme = (theme: string) => loadJson<ObjectThemeManifest>(`${OBJECT_ATLAS_DIR}/${theme}.json`);
const themeOfObject = (id: string) => id.split("_32x32_")[0];

// Anchored by the base: the clicked cell is the bottom-left cell of the art, which grows up and to the right.
export function getObjectItem(id: string): Promise<MapItem> {
  const key = `object:${id}`;
  let cached = itemCache.get(key);
  if (!cached) {
    cached = (async () => {
      const manifest = await loadObjectTheme(themeOfObject(id));
      const entry = manifest.objects.find((object) => object.id === id);
      if (!entry) throw new Error(`Unknown object ${id}`);
      const sheet = await loadImage(objectPageUrl(manifest.pages[entry.page].file));
      const canvas = newCanvas(entry.w, entry.h);
      canvas.getContext("2d")!.drawImage(sheet, entry.x, entry.y, entry.w, entry.h, 0, 0, entry.w, entry.h);
      const tilesH = Math.ceil(entry.h / TILE);
      return {
        kind: "object",
        id,
        layer: "object",
        canvas,
        width: entry.w,
        height: entry.h,
        offsetX: 0,
        offsetY: TILE - entry.h,
        tilesW: Math.ceil(entry.w / TILE),
        tilesH,
        cellDy: -(tilesH - 1),
      } satisfies MapItem;
    })();
    itemCache.set(key, cached);
  }
  return cached;
}

export async function brushFromObject(id: string): Promise<Brush> {
  const item = await getObjectItem(id);
  return { items: [{ item, dx: 0, dy: 0 }], width: item.tilesW, height: 1 };
}

// ---- Room Builder sheets (kept whole, used as they are: drag a rectangle over the sheet) ----
export type SheetKind = "wall" | "floor" | "border";
export const SHEETS: Record<SheetKind, { url: string; cols: number; rows: number }> = {
  wall: { url: "/tiles/Room_Builder_3d_walls_32x32.png", cols: 24, rows: 59 },
  floor: { url: "/tiles/Room_Builder_Floors_32x32.png", cols: 15, rows: 40 },
  border: { url: "/tiles/Room_Builder_borders_32x32.png", cols: 45, rows: 10 },
};

// Cell id is "<col>_<row>" of the sheet.
export function getSheetTileItem(kind: SheetKind, id: string): Promise<MapItem> {
  const key = `${kind}:${id}`;
  let cached = itemCache.get(key);
  if (!cached) {
    cached = (async () => {
      const [col, row] = id.split("_").map(Number);
      if (!Number.isInteger(col) || !Number.isInteger(row)) throw new Error(`Bad cell ${id}`);
      const sheet = await loadImage(SHEETS[kind].url);
      const canvas = newCanvas(TILE, TILE);
      canvas.getContext("2d")!.drawImage(sheet, col * TILE, row * TILE, TILE, TILE, 0, 0, TILE, TILE);
      return {
        kind,
        id,
        layer: kind === "floor" ? "floor" : kind === "wall" ? "wall" : "object",
        canvas,
        width: TILE,
        height: TILE,
        offsetX: 0,
        offsetY: 0,
        tilesW: 1,
        tilesH: 1,
        cellDy: 0,
      } satisfies MapItem;
    })();
    itemCache.set(key, cached);
  }
  return cached;
}

const isEmpty = (canvas: HTMLCanvasElement) => !canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);

// A rectangle of cells keeps its shape; empty cells of the sheet are skipped.
export async function brushFromSheetRect(kind: SheetKind, col0: number, row0: number, col1: number, row1: number): Promise<Brush | null> {
  const items: Brush["items"] = [];
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      const item = await getSheetTileItem(kind, `${col}_${row}`);
      if (!isEmpty(item.canvas)) items.push({ item, dx: col - col0, dy: row - row0 });
    }
  }
  return items.length ? { items, width: col1 - col0 + 1, height: row1 - row0 + 1 } : null;
}

// ---- animated objects (strips of frames, manifest built by scripts/assets/build-animated-manifest.mjs) ----
const ANIMATED_MANIFEST_URL = "/tiles/atlas/animated/animated.json";
export type AnimatedEntry = { id: string; n: number; name: string; w: number; h: number; frames: number; delays: number[]; review?: boolean };
export type AnimatedManifest = { sheetDir: string; objects: AnimatedEntry[] };

export const loadAnimatedManifest = () => loadJson<AnimatedManifest>(ANIMATED_MANIFEST_URL);
export const animatedSheetUrl = (manifest: AnimatedManifest, id: string) => `${manifest.sheetDir}/${id}.png`;

// Same anchoring as objects (clicked cell = bottom-left cell). Frame 0 is drawn; the game will play the rest.
export function getAnimatedItem(id: string): Promise<MapItem> {
  const key = `animated:${id}`;
  let cached = itemCache.get(key);
  if (!cached) {
    cached = (async () => {
      const manifest = await loadAnimatedManifest();
      const entry = manifest.objects.find((object) => object.id === id);
      if (!entry) throw new Error(`Unknown animated object ${id}`);
      const sheet = await loadImage(animatedSheetUrl(manifest, id));
      const canvas = newCanvas(entry.w, entry.h);
      canvas.getContext("2d")!.drawImage(sheet, 0, 0, entry.w, entry.h, 0, 0, entry.w, entry.h);
      // All frames side by side, so the scene can play them (hover in the editor, always on in the game).
      const strip = newCanvas(entry.w * entry.frames, entry.h);
      strip.getContext("2d")!.drawImage(sheet, 0, 0, strip.width, strip.height, 0, 0, strip.width, strip.height);
      const tilesH = Math.ceil(entry.h / TILE);
      return {
        animation: { strip, frames: entry.frames, frameW: entry.w, delays: entry.delays },
        kind: "animated",
        id,
        layer: "object",
        canvas,
        width: entry.w,
        height: entry.h,
        offsetX: 0,
        offsetY: TILE - entry.h,
        tilesW: Math.ceil(entry.w / TILE),
        tilesH,
        cellDy: -(tilesH - 1),
      } satisfies MapItem;
    })();
    itemCache.set(key, cached);
  }
  return cached;
}

export async function brushFromAnimated(id: string): Promise<Brush> {
  const item = await getAnimatedItem(id);
  return { items: [{ item, dx: 0, dy: 0 }], width: item.tilesW, height: 1 };
}
