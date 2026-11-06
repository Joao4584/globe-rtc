// Builds the manifest of the animated objects (frame size, frame count, delay of every frame).
// Spritesheets are horizontal strips used as they are; the size and the timing only exist in the matching GIF.
//
//   node apps/web/scripts/assets/build-animated-manifest.mjs     (run from the repo root; or: pnpm --filter web assets:animated)
//
// Reads  public/tiles/animated-objects/{spritesheets,gif}/Animated_32x32_<n>_<hash>.{png,gif}
//        assets-registry/animated-objects.names.json   (id -> original file names, used as the searchable name)
// Writes public/tiles/atlas/animated/animated.json
// Objects marked "review": true had no GIF or disagree with it: frame width / delays are a guess, check them by eye.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../../..");
const webRoot = path.join(repoRoot, "apps/web");
const sheetsDir = path.join(webRoot, "public/tiles/animated-objects/spritesheets");
const gifDir = path.join(webRoot, "public/tiles/animated-objects/gif");
const namesFile = path.join(webRoot, "assets-registry/animated-objects.names.json");
const outFile = path.join(webRoot, "public/tiles/atlas/animated/animated.json");

const require = createRequire(path.join(repoRoot, "packages/skin-generator/package.json"));
const { PNG } = require("pngjs");

const DEFAULT_DELAY = 100;
const names = JSON.parse(fs.readFileSync(namesFile, "utf8"));

// Width, height and the delay of every frame (browsers show anything under 20ms as 100ms, so do we).
function readGif(file) {
  const bytes = fs.readFileSync(file);
  const delays = [];
  for (let i = 0; i < bytes.length - 7; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4) {
      const delay = bytes.readUInt16LE(i + 4) * 10;
      delays.push(delay < 20 ? DEFAULT_DELAY : delay);
    }
  }
  return { w: bytes.readUInt16LE(6), h: bytes.readUInt16LE(8), delays };
}

const readableName = (original) =>
  (original ?? "")
    .replace(/\.(png|gif)$/i, "")
    .replace(/^animated_/i, "")
    .replace(/_?32x32(-sheet)?$/i, "")
    .replace(/_USE_THE_SPRITESHEET/i, "")
    .replace(/[_\s]+/g, " ")
    .trim();

const objects = [];
const review = [];
const skipped = [];

for (const [id, original] of Object.entries(names)) {
  if (!original.sheet) {
    skipped.push(`${id} (gif only: ${original.gif})`);
    continue;
  }
  const sheetFile = path.join(sheetsDir, `${id}.png`);
  const sheet = PNG.sync.read(fs.readFileSync(sheetFile));
  const gif = original.gif ? readGif(path.join(gifDir, `${id}.gif`)) : null;
  if (!gif && sheet.height > 160) {
    skipped.push(`${id} (${sheet.width}x${sheet.height} looks like a grid of sheets, not a strip: ${original.sheet})`);
    continue;
  }
  const n = Number(id.split("_")[2]);

  let w;
  let frames;
  let delays;
  let needsReview = false;

  if (gif && sheet.height === gif.h && sheet.width === gif.w * gif.delays.length) {
    w = gif.w;
    frames = gif.delays.length;
    delays = gif.delays;
  } else if (gif && sheet.width % gif.delays.length === 0 && sheet.width / gif.delays.length >= 16) {
    // The GIF is on another canvas size, but the sheet still splits into as many frames as the GIF has.
    frames = gif.delays.length;
    w = sheet.width / frames;
    delays = gif.delays;
    needsReview = true;
  } else {
    // No usable GIF: keep the GIF width if the sheet splits into whole frames, otherwise guess 64 or 32.
    w = gif && sheet.width % gif.w === 0 ? gif.w : sheet.width % 64 === 0 ? 64 : 32;
    frames = Math.max(1, Math.round(sheet.width / w));
    delays = gif ? [...gif.delays, ...Array(frames).fill(gif.delays.at(-1) ?? DEFAULT_DELAY)].slice(0, frames) : Array(frames).fill(DEFAULT_DELAY);
    needsReview = true;
  }

  const entry = { id, n, name: readableName(original.sheet), w, h: sheet.height, frames, delays };
  if (needsReview) {
    entry.review = true;
    review.push(`${id} ${sheet.width}x${sheet.height} -> ${frames} frames of ${w}px (${original.sheet})`);
  }
  objects.push(entry);
}

objects.sort((a, b) => a.n - b.n);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ version: 1, sheetDir: "/tiles/animated-objects/spritesheets", objects }));

console.log(`${objects.length} animated objects written to ${path.relative(repoRoot, outFile)}`);
if (review.length) console.log(`\nNeed a look (${review.length}):\n  ${review.join("\n  ")}`);
if (skipped.length) console.log(`\nSkipped, no spritesheet (${skipped.length}):\n  ${skipped.join("\n  ")}`);
