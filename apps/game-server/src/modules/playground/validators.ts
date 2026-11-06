// A skin is "ghost" (no custom character yet, or invisibility mode) or "u:<file id>:<version>" (a character saved from the Character page).
const CUSTOM_SKIN = /^u:[A-Za-z0-9_-]{1,40}:\d{1,16}$/;

export function sanitizeColor(color?: string | null, fallback = "#27c498") {
  if (!color || typeof color !== "string") return fallback;
  const match = color.match(/^#?[0-9a-fA-F]{6}$/);
  if (!match) return fallback;
  return color.startsWith("#") ? color : `#${color}`;
}

export function sanitizeName(name?: string | null, fallback: string) {
  if (!name) return fallback;
  const trimmed = name.toString().trim().slice(0, 32);
  return trimmed || fallback;
}

export function sanitizeId(id?: string | null, fallback: string) {
  if (!id) return fallback;
  return id.toString().slice(0, 32);
}

export function sanitizeSkin(skin?: string | null) {
  if (!skin) return "ghost";
  const value = skin.toString();
  return CUSTOM_SKIN.test(value) ? value : "ghost";
}

export function sanitizeMessage(raw?: string | null) {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.replace(/[\r\n\t]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, 120);
}
