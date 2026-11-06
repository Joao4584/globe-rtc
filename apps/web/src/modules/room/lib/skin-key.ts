// Pure helpers about the skin string (no Phaser import, so React code and the server render can use them).
// A skin is `u:<file id>:<version>` for a character saved from the Character page; the version changes on every update
// so the new sheet is loaded. "ghost" is used until the player has a custom character (and in invisibility mode).
export const FALLBACK_SKIN = "ghost";

export const CUSTOM_SKIN = /^u:([A-Za-z0-9_-]{1,40}):(\d{1,16})$/;

export const isCustomSkin = (skin: string) => CUSTOM_SKIN.test(skin);

/** The skin string for a saved character: `url` is what GET /skin/me returns (`/skin/file/<id>.png?v=<version>`). */
export function skinFromSavedUrl(url: string | null | undefined): string {
  const match = /\/skin\/file\/([A-Za-z0-9_-]+)\.png\?v=(\d+)/.exec(url ?? "");
  return match ? `u:${match[1]}:${match[2]}` : FALLBACK_SKIN;
}

/** Where the sheet of a custom skin is served (public route of the API, through the web proxy). */
export function skinSheetUrl(skin: string) {
  const match = CUSTOM_SKIN.exec(skin);
  return match ? `/backend/skin/file/${match[1]}.png?v=${match[2]}` : null;
}
