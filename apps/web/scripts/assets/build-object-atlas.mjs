// Packs the per-object PNGs (public/tiles/objects/<Theme>/<Theme>_32x32_<n>_<hash>.png) into one atlas per theme
// (pages of at most PAGE x PAGE px, every sprite extruded by 1px so zoomed cameras never show seams) and writes the
// manifest the editor and the game read. See .claude/docs/object-atlas.md.
//
//   node apps/web/scripts/assets/build-object-atlas.mjs            (run from the repo root)
//   node apps/web/scripts/assets/build-object-atlas.mjs --write-registry   (also update the committed id registry)
//
// Output (public/tiles/atlas/objects/):
//   index.json          themes and where their manifest is
//   <Theme>.json        pages and the rectangle of every object of that theme
//   <Theme>-<page>.png  the atlas pages
// The object id is the source file name without ".png" (theme + original number + 5 chars of the image hash).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../../..");
const webRoot = path.join(repoRoot, "apps/web");
const sourceDir = path.join(webRoot, "public/tiles/objects");
const outDir = path.join(webRoot, "public/tiles/atlas/objects");
const registryPath = path.join(webRoot, "assets-registry/objects.registry.json");

// pngjs is only installed for the skin generator package; reuse it instead of adding a dependency to the web app.
const require = createRequire(path.join(repoRoot, "packages/skin-generator/package.json"));
const { PNG } = require("pngjs");

const PAGE = 2048;
const EXTRUDE = 1;
const writeRegistry = process.argv.includes("--write-registry");

const nameRe = /^(.+)_32x32_([0-9]+)_([0-9a-f]{5})[.]png$/;

function readThemes() {
  const themes = [];
  for (const dir of fs.readdirSync(sourceDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const objects = [];
    for (const file of fs.readdirSync(path.join(sourceDir, dir.name)).sort()) {
      const match = file.match(nameRe);
      if (!match) {
        console.warn(`skipped (name does not follow Theme_32x32_<n>_<hash>.png): ${dir.name}/${file}`);
        continue;
      }
      const bytes = fs.readFileSync(path.join(sourceDir, dir.name, file));
      const sha = crypto.createHash("sha1").update(bytes).digest("hex");
      if (sha.slice(0, 5) !== match[3]) {
        console.warn(`hash suffix does not match the image (art changed?): ${dir.name}/${file}`);
      }
      const png = PNG.sync.read(bytes);
      objects.push({ id: file.slice(0, -4), n: Number(match[2]), w: png.width, h: png.height, sha, png });
    }
    objects.sort((a, b) => a.n - b.n);
    themes.push({ name: dir.name, objects });
  }
  return themes.sort((a, b) => a.name.localeCompare(b.name));
}

// Shelf packing, tallest first. Returns pages with the position of every sprite (inside its extruded cell).
function pack(objects) {
  const order = [...objects].sort((a, b) => b.h - a.h || b.w - a.w || a.n - b.n);
  const pages = [];
  let page = null;
  let shelf = null;
  const newPage = () => {
    page = { items: [], height: 0 };
    pages.push(page);
    shelf = { y: 0, x: 0, h: 0 };
  };
  newPage();
  for (const object of order) {
    const cellW = object.w + EXTRUDE * 2;
    const cellH = object.h + EXTRUDE * 2;
    if (cellW > PAGE || cellH > PAGE) throw new Error(`${object.id} is bigger than a page`);
    if (shelf.x + cellW > PAGE) {
      shelf = { y: shelf.y + shelf.h, x: 0, h: 0 };
    }
    if (shelf.y + Math.max(shelf.h, cellH) > PAGE) {
      newPage();
    }
    shelf.h = Math.max(shelf.h, cellH);
    page.items.push({ object, x: shelf.x + EXTRUDE, y: shelf.y + EXTRUDE });
    shelf.x += cellW;
    page.height = Math.max(page.height, shelf.y + shelf.h);
  }
  return pages;
}

function drawPage(page) {
  const width = PAGE;
  const height = Math.max(1, page.height);
  const out = new PNG({ width, height });
  for (const { object, x, y } of page.items) {
    const { png } = object;
    // Copy the sprite and its 1px border (the border repeats the nearest edge pixel).
    for (let dy = -EXTRUDE; dy < object.h + EXTRUDE; dy++) {
      for (let dx = -EXTRUDE; dx < object.w + EXTRUDE; dx++) {
        const sx = Math.min(object.w - 1, Math.max(0, dx));
        const sy = Math.min(object.h - 1, Math.max(0, dy));
        const from = (sy * png.width + sx) * 4;
        const to = ((y + dy) * width + (x + dx)) * 4;
        out.data[to] = png.data[from];
        out.data[to + 1] = png.data[from + 1];
        out.data[to + 2] = png.data[from + 2];
        out.data[to + 3] = png.data[from + 3];
      }
    }
  }
  return { buffer: PNG.sync.write(out), width, height };
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const themes = readThemes();
const index = { version: 1, tileSize: 32, extrude: EXTRUDE, themes: [] };
const registry = {};
const byHash = new Map();
let total = 0;

for (const theme of themes) {
  const pages = pack(theme.objects);
  const manifest = { version: 1, theme: theme.name, pages: [], objects: [] };

  pages.forEach((page, pageIndex) => {
    const file = `${theme.name}-${pageIndex}.png`;
    const drawn = drawPage(page);
    fs.writeFileSync(path.join(outDir, file), drawn.buffer);
    manifest.pages.push({ file, width: drawn.width, height: drawn.height });
    for (const { object, x, y } of page.items) {
      manifest.objects.push({ id: object.id, n: object.n, page: pageIndex, x, y, w: object.w, h: object.h });
    }
  });
  manifest.objects.sort((a, b) => a.n - b.n);

  for (const object of theme.objects) {
    registry[object.id] = { w: object.w, h: object.h };
    byHash.set(object.sha, [...(byHash.get(object.sha) ?? []), object.id]);
  }
  fs.writeFileSync(path.join(outDir, `${theme.name}.json`), JSON.stringify(manifest));
  index.themes.push({ name: theme.name, label: theme.name.replace(/_/g, " "), count: manifest.objects.length, pages: pages.length, manifest: `${theme.name}.json` });
  total += manifest.objects.length;
  console.log(`${theme.name}: ${manifest.objects.length} objects, ${pages.length} page(s)`);
}

fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index));

const duplicates = [...byHash.values()].filter((ids) => ids.length > 1);
console.log(`\n${total} objects in ${themes.length} themes. Identical images under different ids: ${duplicates.length} groups.`);

// Registry: the ids that exist, kept in git (text only, no art) to notice when the pack changes under saved maps.
if (fs.existsSync(registryPath)) {
  const previous = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const gone = Object.keys(previous).filter((id) => !(id in registry));
  if (gone.length) console.warn(`WARNING: ${gone.length} ids from the registry no longer exist (maps using them will show a placeholder), e.g. ${gone.slice(0, 3).join(", ")}`);
}
if (writeRegistry) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry));
  console.log(`registry written: ${path.relative(repoRoot, registryPath)}`);
}
