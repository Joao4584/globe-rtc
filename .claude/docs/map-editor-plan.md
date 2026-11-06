# Map editor / asset catalog (planned)

User idea: instead of only placing furniture on one fixed map,
build a **map editor page** where maps are created from tilesets, so we can make
many rooms, templates and patterns.

## Built so far: Editor tab (structure only)

- Sidebar tab **Editor** (icon `PencilRuler`, route `/app/editor`, defined in
  `modules/workspace/routes/dashboard.routes.ts`, next to "Recentes").
- `/app/editor`: list of the user's **map templates**: count, search by name, sort
  (most recent / A-Z), reload, and "Novo template" (dialog asks only for a name; the map
  starts empty = "from scratch"). No favorite button (user decision). Code in
  `apps/web/src/modules/editor/`.
- `/app/editor/<public_id>`: the **builder page**: full-screen black Phaser canvas
  (`modules/editor/scenes/builder-scene.ts`) with an endless 32px grid, a square that
  follows the mouse snapped to the grid, tile coordinates at the bottom-left, pan with
  middle/right mouse drag, zoom with the wheel. It does not paint yet.
- **Palette + brush (local test model, no DB)**: bottom-right "Paleta" button opens a menu
  with two tabs, both the same idea (user decision: no need to classify objects first): the
  whole sheet is shown 1:1 and you **drag a rectangle** to copy exactly that block of tiles.
  *Objetos* = `Interiors_32x32` (shown from the de-extruded chunks; a "Ir para..." select jumps
  to theme row bands from `interiors-32.rules.json`; the copied block is saved as kind `region`,
  id `<col>_<row>_<w>_<h>`); *Paredes e chao* = `room_wall_32x32.png` (kind `tile`, one entry per
  non-empty tile). The older auto-detected pieces (`piece`, `interiors-32.json`, `p:` refs) were removed (user decision).
  The pick sticks to
  the mouse as a ghost; **left click places, right click erases** (front-most object under the
  cell first, else the tile), **middle button or Space+drag pans**, wheel zooms, Esc drops the
  brush. Layers: floor < wall < objects (objects sorted by bottom edge). The map is saved only with the
  Save button, into the database (see `map-format.md`; no local draft, user decision). The grid origin (0,0), marked with a dot and "0,0 · centro", is the **centre of the
  map** (user decision). Code: `modules/editor/assets/map-assets.ts` (cuts tiles/regions out of
  the 1px-extruded sheets into canvases; verified pixel-identical to the originals),
  `scenes/builder-scene.ts`, `components/map-palette.tsx`.
- **Layers** (see `map-layers.md`): a panel on the left of the builder page with a stack of layers
  (default: Chao, Parede, Objetos (sorts with players by y), Por cima (above players), Colisao),
  modelled on the 5 layers of the example Tiled map. Add / rename (double click) / reorder /
  hide / lock / delete; painting and erasing act on the active layer. The collision layer paints
  translucent red cells (left paints, right erases), as the user defines collision themselves.
  The app header stays on top of the builder page, so its overlay texts sit below it.
- **Theme (user request)**: every editor button, menu, card and field uses the same look as the
  in-game cards (ping / invisibility / chat in `modules/room/components`): translucent
  `slate-900` cards with a soft border in dark mode, white cards with a `sky` border in light
  mode, small uppercase captions, `slate-800` fields, `slate-700` buttons. The classes live in
  `modules/editor/ui/theme.ts` (`ui.panel`, `ui.button`, `ui.ghost`, `ui.field`...): reuse
  them for new editor UI instead of hard-coding colors.
- API: table `map_template` (migration `1772300000000-CreateMapTemplate`; columns
  public_id, user_id, name, `data` jsonb default `{}`, timestamps, soft delete) and
  `map-template` endpoints (POST create, GET list `?sort=recent|alphabetical`, GET
  `:public_id`, DELETE). Owner-only. Code in `apps/api/src/application/map-template/`.
- Not built: templates the system ships ("that I already made"), saving/rename, painting,
  rooms from templates. The user wants to define the editor rules while building it.

## Asset tiers

The user will provide full tileset pages under `apps/web/public/tiles/<pack>/<tier>/`
(user decision: everything stays in `public/tiles`; the empty `public/assets/tilesets`
folders were removed). Tiers:

- `floors/`  ground
- `walls/`   walls
- `objects/` furniture/props

The user builds an "assets page" with all of them. The earlier hand-cut catalog in
`apps/web/src/modules/room/decor/catalog.ts` (pixel rectangles of
Interiors_32x32.png) is a temporary stopgap: ignore it for the new work.

## Decision: keep sheets whole, define regions in a manifest

Do NOT physically cut sheets into many PNGs. Keep each original sheet untouched in
its tier folder and describe pieces as rectangles (x, y, w, h in tiles) in a
manifest. Reasons: non-destructive, re-definable, one texture per sheet in Phaser,
neighbouring tiles stay available for autotiling. For `objects/`, an import script
auto-detects candidate pieces (connected non-transparent areas) so the user only
confirms/names them in the assets page instead of drawing every box.

## Next steps (agreed direction, to confirm when starting)

1. Assets page: browse a tileset page and mark regions as floor / wall / object
   (size in tiles, name; collision is drawn by the user, see below). Store as a manifest (JSON or DB).
2. Map editor: paint floor, walls and place objects on a grid; save as a template.
3. Rooms start from a template; room decoration (see room-decoration.md) then
   becomes objects from the manifest instead of the hardcoded catalog.

## Where assets live (decided)

Assets stay in the web app: `apps/web/public/tiles/<pack>/<tier>/` (e.g. `tiles/interiors/objects/`)
(served to players). Licensed art that must never be served stays in
`packages/skin-generator/private-assets/` (git-ignored by that package). A central `packages/assets` package was tried and
rejected by the user; do not recreate it.

## Progress

- Interiors sheet mapped into a piece manifest and the room builder sheet (walls/floors)
  into a per-tile manifest (see `asset-manifest.md`).
- Editor tab + template list + empty grid builder page (see top of this file).

## Tile picker + brush (user idea, planned)

The user wants a page where a whole sheet is shown as a grid of 32px squares. You click
a square (or drag a rectangle of squares) and that selection becomes the **brush**
("stamp"): it is copied, and you then draw on the map by clicking/dragging, repeating the
stamp. Same flow for every tier.

- Walls/floors: sheet `public/tiles/room-builder/room_wall_32x32.png`, manifest
  `room-wall-32.json` (one entry per tile, category wall/floor/void). The picker shows the
  grid with a category filter and a "style block" selector (the sheet repeats a 10x10
  style in many colors). Selection = list of tile ids `rw32_r<row>c<col>` laid out as a
  small w x h pattern.
- Objects: sheet `public/tiles/interiors/objects/`, manifest `interiors-32.json`. Clicking
  a piece selects the whole piece (its rectangle), because pieces are already detected.
  Filter by category and by theme band.
- Brush tools: paint (stamp repeated), erase, rectangle fill, eyedropper (pick what is on
  the map). Walls/floors paint on tile layers; objects are placed freely on the grid.

### Map data model (saved in `map_template.data`, ids only)

```
map: { size:[cols,rows], layers: {
  floor:   [ [tileId|null, ...], ... ],   // rw32_... ids, one per cell
  walls:   [ [tileId|null, ...], ... ],
  objects: [ { piece:"i32_r10c0", x, y } ],   // x,y in tiles
  collision: [ { x, y, w, h } ]           // painted by the user (red blocks)
} }
```

Templates are just maps flagged as templates; a room starts from a copy. The static
manifests are the only source of what an id looks like, so the DB never stores pixels.

### Build order

1. Walls/floors manifest (done) -> 2. editor tab, template list, empty builder (done)
-> 3. picker + brush on the builder grid -> 4. save/load `data` -> 5. collision painting
-> 6. templates and rooms from templates. Still open before step 3: wall/floor sub-roles
(top, face, corner) and autotiling, which decide whether painting a wall needs one click
per tile or can be smart.

## Collision (user rule, not built yet)

Do NOT map or guess collision anywhere (manifests, categories, scripts). Auto-guessing
was tried and rejected: it marked the top of tall objects as blocking. The user defines
collision by hand: in the map editor the creator paints collision blocks (a translucent
red rectangle) over the places that should block walking, area by area. This matters
because many objects are 2 tiles tall and only the bottom part should block. Until the
editor exists, furniture has no collision (see room-decoration.md).

## Undo / redo (editor)
- `BuilderScene` keeps whole-state snapshots (layers, active layer, placed items), up to 100. One mouse stroke (paint or erase
  across many cells) = one step; layer add/rename/update/move/remove are steps too. Changing the active layer is not.
- Buttons next to Save; Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo (ignored while typing in a field). A new action clears redo.
- History is not saved and is lost on reload. After undoing, the map counts as unsaved even if it equals the saved one.
