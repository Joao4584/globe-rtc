# Map format and saving

Decision (user): the editor saves the map as **one JSON in the database** (`map_template.data`,
jsonb). The **Save** button always overwrites that same JSON (no versions). The game engine
will read this JSON; the old Tiled map (`wall-room-v2.json`) was **removed** (user decision) and the
default map will be made in our own editor (the user will build it and later mark it as default).

## Why not keep Tiled JSON

Tiled stores a dense `width x height` array of GIDs per layer, tied to `firstgid` offsets of
each tileset. That does not fit us: the editor map is endless (negative coords, origin 0,0 =
centre), tilesets change, and layers need our own `mode`. Our format is **sparse** (only
placed things) and refers to art by **stable ids** from the manifests, so re-cutting a sheet
never breaks a saved map. A Tiled exporter can be added later if ever needed.

## Format v3 (`MapData`, `modules/editor/assets/map-data.ts`)

```json
{
  "version": 3,
  "tileSize": 32,
  "bounds": { "minX": -10, "minY": -6, "maxX": 34, "maxY": 19 },
  "layers": [
    { "id": "floor", "name": "Chao", "type": "art", "mode": "below", "visible": true, "locked": false,
      "items": [["t:rw32_r3c4", -2, 0], ["r:3_5_2_2", 4, 1]] },
    { "id": "collision", "name": "Colisao", "type": "collision", "mode": "below", "visible": true, "locked": false,
      "cells": [[0, 0], [1, 0]] }
  ],
  "activeLayer": "floor"
}
```

- `layers` are bottom to top. Inside an art layer, **array order = placement order** (later is
  drawn on top); in a `ysort` layer the order is by bottom edge instead (see `map-layers.md`).
- Tile coordinates `x,y` are cells, origin (0,0) = map centre. `bounds` = inclusive box of
  everything placed (null when empty): the engine can use it for the camera and room size.
- Item refs `"<kind>:<id>"`: `t:` = one wall/floor tile (`rw32_r<row>c<col>`, sheet
  `room_wall_32x32.png`); `r:` = a rectangle of the objects sheet `<col>_<row>_<w>_<h>` in tiles
  (`Interiors_32x32.png`). (`p:` auto-detected pieces were removed: no saved map used them.)
- `visible`, `locked`, `activeLayer`, layer `name` are editor data; the engine ignores them
  (it may still skip `visible: false`).
- Art layers may carry `"floor": true` (footprint button in the layers panel; the default Floor layer has it). It is explicit in the editor and marks **where players can walk and spawn**: the engine takes every cell covered by the items of floor layers, minus collision cells (same rule as the old Tiled `findSpawnOnFloor`, but not tied to the layer name). A dedicated spawn-point layer is a possible later addition (user has not asked yet).
- Collision layers hold `cells`; the user paints them, nothing is guessed.
- Old formats (v1, v2 from the first local tests) are migrated when read.

## API

- `GET /map-template/:public_id` -> `{ public_id, name, created_at, updated_at, data }`.
- `PUT /map-template/:public_id` body `{ data }` -> same shape. Owner only. Replaces `data`
  (last write wins, no history; a second tab can overwrite the first: add an
  `expected_updated_at` check if that ever hurts). The server **validates** the shape and
  limits (version 3, <= 64 layers, <= 100k items/cells in total, coordinates within +-100000,
  known layer types/modes) and rejects anything else with 400. Body limit raised to 5 MiB.

## Editor

Save button (and Ctrl+S) next to the template name: `Salvar` (when there are changes) ->
`Salvando...` -> `Salvo`. The map opens from the database. There is **no local draft**
(user decision): a refresh without saving loses the changes, so leaving with unsaved changes
(close tab, Back link) asks for confirmation.

Status: **built** (Save button + Ctrl+S, `PUT /map-template/:public_id`, validator in
`apps/api/src/application/map-template/map-data.validator.ts`, Fastify bodyLimit 5 MiB).

## Rooms and the game engine (built, first version)

- `room.map_template_id` (nullable FK to `map_template`, ON DELETE SET NULL). `POST /room` accepts
  optional `map_template_id` (public id of one of the creator's templates); the Create room dialog
  has a required `Mapa` select (first template preselected). A room without a map (older rooms)
  gets an empty walkable box so the game still runs.
- `GET /room/:public_id` returns `map` (the template JSON, or null). Private rooms only give it to
  non-visitors. A template is used by reference: editing and saving it changes every room that
  uses it.
- Web: `PhaserGame` cuts the map (`modules/room/lib/template-map.ts`, reusing the editor's
  `map-assets`) before creating the game; `MainScene` branches on registry key `template-map`.
  Depth: `below` under everything, `above` over everything, `ysort` shares the players' depth (y).
  Collision cells become invisible static bodies; ground = cells of floor layers minus collision
  (if no layer is marked floor, every painted cell counts); spawn = random ground cell.
- Removed with the old map: `MapManager.createMap/getWorldBounds/findSpawnOnFloor`, the old
  `WalkableResolver`, the tilemap/tileset loading in `preloader.ts`, `public/tiles/wall-room*.json`
  and `block_builder_32x32*.png`. Only `MapManager.setupWheelZoom` is left in that file.
- Not done yet: default template flag (set a template as the default for rooms without one), spawn
  point markers, game-server aware of the map (it still sends a random position, the client snaps
  it to the nearest ground), per-room overrides, moving `map-assets.ts` to a shared module.
