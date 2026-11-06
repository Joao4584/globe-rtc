# Object atlas and manifest

Source art: `apps/web/public/tiles/objects/<Theme>/<Theme>_32x32_<n>_<hash5>.png` (git-ignored, 5,330 files, 24 themes).

- **Object id** = file name without `.png`. `<n>` is the original pack order, `<hash5>` the first 5 hex chars of the
  SHA-1 of the image. The manifest can always be rebuilt from the names; a changed image shows a hash warning.
- **Build**: `pnpm.cmd --filter web assets:objects` (or `node apps/web/scripts/assets/build-object-atlas.mjs [--write-registry]`).
- **Output** (`apps/web/public/tiles/atlas/objects/`, generated, git-ignored): `index.json` (themes), `<Theme>.json`
  (pages + rect of every object: id, n, page, x, y, w, h), `<Theme>-<page>.png` (2048px wide pages, 1px extruded sprites
  so zoomed cameras show no seams). Currently every theme fits one page (4.5 MB total).
- **Registry**: `apps/web/assets-registry/objects.registry.json` (committed, ids + sizes, no art). The script warns when
  an id of the registry no longer exists, so saved maps are not silently broken.
- Maps store only ids (planned item kind `o:<id>`); `t:`/`r:` refs keep working. Objects are anchored by their base
  (bottom-left of the clicked cell) because ~36% of sizes are not multiples of 32.
- Editor/game should load only the theme atlases a map uses; the API should validate ids against the registry.
- 22 groups of identical images exist under different ids (kept; harmless).
- Production: the art and generated atlases are git-ignored, so they must be delivered to servers some other way.
- Next: editor palette by theme, `o:` item kind, remove `public/tiles/old_interiors/objectsOld` after migration.

## Editor (done)
- Palette "Objects" tab: category (theme) select + text filter (id or number) + thumbnails; click picks the object.
  Walls/floor tab unchanged for now (user will decide later).
- New item kind `object`, saved as `o:<id>` (API validator accepts `[tro]:`). Anchored by the base: the clicked cell is the
  bottom-left cell, art grows up/right (`MapItem.offsetY = 32 - h`, `cellDy = -(tilesH-1)`).
- Only the theme atlas of a picked/used object is downloaded (`getObjectItem` -> `loadObjectTheme`).
- Old objects sheet palette removed; `r:` refs still render through the old chunks until migration ends.
- Room/game: `template-map.ts` already resolves `o:` ids through `getItem` and honours `cellDy`; still to verify in game.

## Walls, floors, borders (done)
- NOT part of the atlas. The three Room Builder sheets stay whole in `public/tiles/` (`Room_Builder_3d_walls_32x32.png` 24x59,
  `Room_Builder_Floors_32x32.png` 15x40, `Room_Builder_borders_32x32.png` 45x10) and are used as they are.
- Palette tabs: Objects (atlas themes, click) | Walls | Floors | Borders (drag a rectangle over the sheet; empty cells skipped).
- Saved refs, one per 32px cell: `w:<col>_<row>`, `f:<col>_<row>`, `b:<col>_<row>`. Objects are `o:<id>`.
  Defined in `SHEETS` (map-assets.ts); the API ref pattern is `^[owfb]:[A-Za-z0-9_]+$`.
- The old `t:`/`r:` kinds and the chunked interiors sheet are gone; old maps with them lose those items when parsed.
- Floor/spawn/collision behaviour still depends on the layer the cells are painted on (floor flag), not on the kind.
