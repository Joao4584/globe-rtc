# Asset manifest (tileset pieces)

Goal: the future map editor / room decoration must know what every sprite in a tileset
sheet is (floor covering, furniture, plant...), without cutting the sheet into files.

## Decision: static JSON in git, DB only for user data

- The catalog of pieces is **static art metadata**: it changes when we add art, not when
  users play. So it is a JSON file committed with the code, read by the web app and the
  API (to validate ids). No migration for it.
- The **database** is for user-made things: maps, templates, room layouts. Those store
  piece ids (`i32_r10c0`) and positions, never pixel rectangles.
- The sheets stay whole (see `map-editor-plan.md`). A piece is a pixel rectangle of the
  original `public/tiles/interiors/objects/Interiors_32x32.png`; the runtime chunks (`..._chunkN-ext.png`,
  240 rows each, 1px extruded) are only a GPU-size workaround, see `room-decoration.md`.

## Files (`apps/web/public/tiles/interiors/objects/`)

One folder per sheet, holding the original, its runtime chunks (`Interiors_32x32_chunk0..4-ext.png`)
and its two JSON files. Layout: `public/tiles/<pack>/<tier>/` (tier = objects, and later walls/floors).

- `interiors-32.rules.json`: hand-maintained input. `bands` = row ranges with theme
  tags (kitchen, hospital, museum...), `overrides` = pieces whose category was checked by
  eye (`{ "i32_r10c0": { "category": "floor_covering" } }`).
- `interiors-32.json` (auto-detected piece catalog), its generator `build-manifest.mjs`, `detect-pieces.mjs` and the
  `assets:manifest` script were **removed** (user decision, 2026-11): the palette selects rectangles of the sheet
  and a per-object source (one file per object) is planned instead. Only `bands` of the rules file is still read
  (the palette's "jump to" list).

`i32_r<row>c<col>` = tile row/column of the piece's top-left corner in the sheet. Stable
across re-detection as long as the art does not move. Two pieces with the same corner get
a letter suffix (`b`, `c`).

## Categories (current)

| category | meaning | depth |
|---|---|---|
| `floor_covering` | rugs, mats, carpets; lies flat, under characters | flat |
| `furniture` | default for anything >1 tile: furniture, appliances, big props | by y |
| `plant` | potted plants, trees, bushes | by y |
| `small_item` | 1 tile or less: food, tools, toys | by y |

**Collision is NOT mapped** (user rule): no category or piece says what blocks walking.
The user defines collision areas themselves in the map editor (see `map-editor-plan.md`).
Do not add collision flags or guess them in the manifests.

First pass (Interiors_32x32): 4009 pieces = 2331 furniture, 1618 small_item,
42 floor_covering, 18 plant. Only the floor coverings and plants were checked by eye
(`reviewed: true`); everything else is the default by size. Known gaps: wall-mounted
things (paintings, windows, curtains, clocks) are still `furniture`, and some multi-part
items are one piece while some are split. Fixes go in `overrides` (or the future assets
page writes them).

## Sheet layout (Interiors_32x32, 16 cols x 1064 rows)

It is a mix of themed packs stacked vertically, not one theme. Rough row bands: 0-79
living/bedroom/carpets/stairs/music; 80-160 art, gym, bathroom, fishing; 160-240 kids,
halloween, doors/windows/curtains, library; 240-360 kitchen, classroom; 360-480 game room,
christmas, supermarket; 480-600 market, flowers, jail, hospital, office, cafe; 600-760
reception, hospital, school, kindergarten, bunk beds; 760-880 japanese, clothing store;
880-1000 museum, fossils, dinosaurs, souvenirs; 1000-1064 gym, studio, ice cream, shutters.
The exact bands are in the rules file.

## Walls and floors (`public/tiles/room-builder/`)

Sheet used by the game: `room_wall_32x32.png` (the `-ext.png` copy is what Phaser loads,
1px extruded). 40 x 70 tiles. Unlike the objects sheet, walls/floors are a dense tile grid
(no transparent gaps), so the manifest is **per tile**, not per piece:
`room-wall-32.json` (generated) from `room-wall-32.rules.json` (input), built with
`node scripts/assets/build-tile-manifest.mjs public/tiles/room-builder/room-wall-32.rules.json`
(run from `apps/web` in WSL).

- Tile id `rw32_r<row>c<col>`; category `wall` | `floor` | `void` (the solid black tile).
  Wall = wall tops, wall faces, pillars; floor = the flat patterns and borders.
- The top of the sheet is one **style block** of 10 x 10 tiles repeated (yellow, teal, red,
  purple, pink, cream... 11 styles follow the same arrangement: blocks (col,row) listed in
  `layout.blocks`). The wall/floor map of the first block is copied to those blocks;
  the rest of the sheet (rows 30+, and the last block column of row 20) uses a pixel
  heuristic (white top / dark outline = wall), which is wrong for dark brick/wood styles.
  Every entry has `source` (`layout` | `pixels` | `override`); fix wrong ones with
  `overrides` in the rules file.
- Counts: 1973 tiles = 1263 wall, 697 floor, 13 void (895 from the layout, 1078 by pixels).
- Not yet mapped: sub-roles (wall top vs wall face vs corner), autotile neighbours, and
  `Room_Builder_32x32.png` (2432x3616, bigger, not used by the game; moved next to the
  others). `block_builder_32x32.png` (16x5, removed from the project with the old map) was a helper sheet: floor-shadow tiles and
  entrance/exit markers plus text labels; not mapped.

## Next use of these manifests

The tile picker / brush flow and the saved map format are planned in `map-editor-plan.md`
("Tile picker + brush").

## Not done yet

- Collision areas: drawn by the user in the editor, never auto-mapped (see `map-editor-plan.md`).
- Sub-roles and autotile rules for walls and floors.
- Assets page to review/rename pieces and write `overrides`.
- Names for pieces (ids only for now), wall_decor category.
- Using the manifest in the decoration editor and the API validation.
