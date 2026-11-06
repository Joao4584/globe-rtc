# Map layers (editor)

User request: the editor needs **layers** so an object can be drawn above or below another,
like the example map that was made in Tiled (`wall-room-v2.json`, since removed from the project).

## How the example map does it (what the game does today)

Five fixed tile layers of that old example, drawn in this order (old `MapManager.ts`, removed):

| Tiled layer | Phaser depth | Meaning |
|---|---|---|
| `floor` | 0 | ground |
| `wall` | 1 | walls |
| `blocks` | 3 | furniture/objects (always under players) |
| `wall-top` | 10000 | wall tops: drawn **above** players |
| `collider` | (hidden) | blocking cells, opacity 0.4 in Tiled, `collider: true` property |

Players have depth = their `y`. So everything in `floor/wall/blocks` is under the player, and
only `wall-top` can cover the player. Limits: the order is fixed, one layer per purpose, objects
in `blocks` cannot sort with the player by `y`, and adding "a rug under the table but above the
floor" means editing the tileset.

## Editor model (improvement)

A map has an **ordered stack of layers** (bottom to top). Layers are user data: add, rename,
reorder, hide, lock, delete. Each layer has:

- `type`: `art` (tiles and copied blocks) or `collision` (red translucent cells, painted by the
  user; see the Collision rule in `map-editor-plan.md`).
- `mode` (art only), how the layer relates to **players** in the game:
  - `below`: always under players; items inside draw in placement order (later on top).
  - `ysort`: items sort with players by their bottom edge (`y`), so a player walks behind a
    tall object and in front of a low one.
  - `above`: always over players (the `wall-top` case).
- `visible` / `locked` (editor only; hidden or locked layers can't be painted).

Z-order = stack position first, then inside the layer: placement order (`below`/`above`) or
bottom edge (`ysort`). To put an object over/under another: place it in a higher/lower layer,
or reorder the layers. Painting and erasing always act on the **active layer** only.

Default layers (names are editable, they mirror the example map): Chão (below), Parede
(below), Objetos (ysort), Por cima (above), Colisão (collision).

## Saved format (stored in `map_template.data`, see `map-format.md`)

```
{ version: 2,
  layers: [{ id, name, type, mode, visible, locked }, ...],   // bottom -> top
  activeId,
  placed: [{ kind: "tile"|"region"|"piece"|"collision", id, x, y, layer, seq }, ...] }
```

`x,y` are tile cells (origin 0,0 = map centre), `seq` is placement order. Version 1 saves (no
layers) are migrated on load: tiles go to Chão/Parede by category, blocks to Objetos.

## Game integration (not done)

When rooms load a template: `below` layers get a fixed low depth, `ysort` items get depth = their
bottom `y`, `above` layers get a high depth; collision cells become the physics collider layer
(replacing the hand-made `collider` layer of `wall-room-v2.json`).

## Code

`modules/editor/assets/map-layers.ts` (types, defaults), `scenes/builder-scene.ts` (stack,
depth, painting), `components/layers-panel.tsx` (UI, left side of the builder page).
