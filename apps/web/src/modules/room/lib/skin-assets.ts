import * as Phaser from "phaser";

// Players are drawn with the character their owner built in the Character page: a spritesheet saved on the server.
// A skin is the string `u:<file id>:<version>` (the version changes on every update so the new sheet is loaded).
// Players without a custom character use the "ghost" sprite (the same look as invisibility mode) until they create one.
export const FALLBACK_SKIN = "ghost";

const CUSTOM_SKIN = /^u:([A-Za-z0-9_-]{1,40}):(\d{1,16})$/;
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 64;
const FRAMES_PER_DIRECTION = 6;
/** Order of the directions inside a row of the sheet (same as the skin generator). */
const SHEET_DIRECTIONS = ["right", "up", "left", "down"] as const;
/** Rows of the sheet: idle first, then walk (the sheet also has more rows for adults, not used yet). */
const SHEET_ROWS = { idle: 0, walk: 1 } as const;

export type SkinDirection = (typeof SHEET_DIRECTIONS)[number];
export type SkinMotion = keyof typeof SHEET_ROWS;

export const isCustomSkin = (skin: string) => CUSTOM_SKIN.test(skin);

/** The skin string for a saved character: `url` is what GET /skin/me returns (`/skin/file/<id>.png?v=<version>`). */
export function skinFromSavedUrl(url: string | null | undefined): string {
  const match = /\/skin\/file\/([A-Za-z0-9_-]+)\.png\?v=(\d+)/.exec(url ?? "");
  return match ? `u:${match[1]}:${match[2]}` : FALLBACK_SKIN;
}

function sheetUrl(skin: string) {
  const match = CUSTOM_SKIN.exec(skin);
  return match ? `/backend/skin/file/${match[1]}.png?v=${match[2]}` : null;
}

/** Phaser texture to show for a skin (custom: the whole sheet, ghost: its own idle/walk sheets). */
export const skinTextureKey = (skin: string, motion: SkinMotion) => (isCustomSkin(skin) ? skin : `${skin}-${motion}`);

export const skinAnimKey = (skin: string, motion: SkinMotion, dir: string) => `${skin}-${motion}-${dir}`;

/** True when the textures of this skin are in memory. */
export const skinReady = (scene: Phaser.Scene, skin: string) => scene.textures.exists(skinTextureKey(skin, "idle"));

/** The skin to draw right now: the wanted one when its sheet is loaded, the ghost until then. */
export const usableSkin = (scene: Phaser.Scene, skin: string) => (skinReady(scene, skin) ? skin : FALLBACK_SKIN);

/** Idle and walk animations of a custom skin, cut from its sheet (columns = frames in the widest row). */
export function createSkinAnimations(scene: Phaser.Scene, skin: string) {
  if (!isCustomSkin(skin) || !scene.textures.exists(skin)) return;
  const columns = Math.floor(scene.textures.get(skin).source[0].width / FRAME_WIDTH);
  (Object.keys(SHEET_ROWS) as SkinMotion[]).forEach((motion) => {
    SHEET_DIRECTIONS.forEach((dir, index) => {
      const key = skinAnimKey(skin, motion, dir);
      if (scene.anims.exists(key)) return;
      const start = SHEET_ROWS[motion] * columns + index * FRAMES_PER_DIRECTION;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(skin, { start, end: start + FRAMES_PER_DIRECTION - 1 }),
        frameRate: motion === "walk" ? 10 : 5,
        repeat: -1,
      });
    });
  });
}

/** Adds the sheet of a custom skin to the loader (use inside preload, or call loadSkin later). */
export function queueSkinLoad(scene: Phaser.Scene, skin: string) {
  const url = sheetUrl(skin);
  if (url && !scene.textures.exists(skin)) scene.load.spritesheet(skin, url, { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT });
}

const pending = new WeakMap<Phaser.Scene, Map<string, (() => void)[]>>();

/** Loads a custom skin while the game runs, then calls `onReady` (never called if the sheet cannot be loaded). */
export function loadSkin(scene: Phaser.Scene, skin: string, onReady: () => void) {
  if (skinReady(scene, skin)) {
    createSkinAnimations(scene, skin);
    onReady();
    return;
  }
  if (!isCustomSkin(skin)) return;

  let waiting = pending.get(scene);
  if (!waiting) pending.set(scene, (waiting = new Map()));
  const callbacks = waiting.get(skin);
  if (callbacks) {
    callbacks.push(onReady);
    return;
  }
  waiting.set(skin, [onReady]);

  scene.load.once(`${Phaser.Loader.Events.FILE_COMPLETE}-spritesheet-${skin}`, () => {
    const list = waiting?.get(skin) ?? [];
    waiting?.delete(skin);
    createSkinAnimations(scene, skin);
    list.forEach((callback) => callback());
  });
  scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => waiting?.delete(skin));
  queueSkinLoad(scene, skin);
  if (!scene.load.isLoading()) scene.load.start();
}
