import * as Phaser from "phaser";
import { TILE, getItem, itemKey, type ItemKind, type MapItem } from "@/modules/editor/assets/map-assets";
import { parseMap } from "@/modules/editor/assets/map-data";
import type { LayerMode } from "@/modules/editor/assets/map-layers";

// A map saved by the editor (format v3, see .claude/docs/map-format.md) turned into what the game scene needs.
// Depth: "below" layers sit under everything, "above" over everything, "ysort" layers share the players' depth (y).
const BELOW_BASE = -100_000_000;
const ABOVE_BASE = 100_000_000;
const LAYER_STEP = 1_000_000;
const PAD_TILES = 4;
const SEARCH_RADIUS = 8;
// Players are sorted by their sprite centre (depth = y) but stand on the sprite bottom (frame is 64px tall), so an
// object's sorting line is moved up by that distance: the player passes behind it only while the feet are above its base.
const PLAYER_FEET_OFFSET = 32;

export type TemplateDrawable = { item: MapItem; x: number; y: number; depth: number; mode: LayerMode; layer: number };

export type TemplateMapData = {
  drawables: TemplateDrawable[];
  collisionCells: [number, number][];
  /** cells players may stand on (floor layers minus collision) */
  walkable: Set<string>;
  walkableList: [number, number][];
  /** world bounds in pixels, with padding */
  bounds: { x: number; y: number; width: number; height: number };
};

const cellKey = (x: number, y: number) => `${x},${y}`;

export async function prepareTemplateMap(raw: unknown): Promise<TemplateMapData | null> {
  const parsed = parseMap(raw);
  if (!parsed?.layers) return null;

  const layers = parsed.layers;
  const layerIndex = new Map(layers.map((layer, index) => [layer.id, index]));
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const floorLayers = new Set(layers.filter((layer) => layer.type === "art" && layer.floor).map((layer) => layer.id));

  const artRecords = parsed.records.filter((rec) => rec.kind !== "collision" && layerById.get(rec.layer)?.type === "art");
  const loaded = await Promise.all(
    artRecords.map((rec, seq) =>
      getItem(rec.kind as ItemKind, rec.id)
        .then((item) => ({ rec, item, seq }))
        .catch(() => null),
    ),
  );

  const drawables: TemplateDrawable[] = [];
  const groundCells = new Set<string>();
  const anyArtCells = new Set<string>();

  for (const entry of loaded) {
    if (!entry) continue;
    const { rec, item, seq } = entry;
    const layer = layerById.get(rec.layer);
    if (!layer) continue;

    for (let dx = 0; dx < item.tilesW; dx++) {
      for (let dy = 0; dy < item.tilesH; dy++) {
        const key = cellKey(rec.x + dx, rec.y + item.cellDy + dy);
        anyArtCells.add(key);
        if (floorLayers.has(layer.id)) groundCells.add(key);
      }
    }

    if (!layer.visible) continue;
    const x = rec.x * TILE + item.offsetX;
    const y = rec.y * TILE + item.offsetY;
    const index = layerIndex.get(layer.id) ?? 0;
    const depth =
      layer.mode === "below"
        ? BELOW_BASE + index * LAYER_STEP + seq
        : layer.mode === "above"
          ? ABOVE_BASE + index * LAYER_STEP + seq
          : y + item.height - PLAYER_FEET_OFFSET + index * 0.01 + seq * 1e-7;
    drawables.push({ item, x, y, depth, mode: layer.mode, layer: index });
  }

  if (!drawables.length) return null;

  const collision = parsed.records.filter((rec) => rec.kind === "collision" && layerById.get(rec.layer)?.type === "collision");
  const collisionCells = collision.map((rec): [number, number] => [rec.x, rec.y]);
  const blocked = new Set(collisionCells.map(([x, y]) => cellKey(x, y)));

  // No layer marked as floor: every painted cell counts as ground, so old or half-made maps still work.
  const ground = groundCells.size ? groundCells : anyArtCells;
  const walkable = new Set([...ground].filter((key) => !blocked.has(key)));
  const walkableList = [...walkable].map((key): [number, number] => {
    const [x, y] = key.split(",").map(Number);
    return [x, y];
  });

  const minX = Math.min(...drawables.map((d) => d.x));
  const minY = Math.min(...drawables.map((d) => d.y));
  const maxX = Math.max(...drawables.map((d) => d.x + d.item.width));
  const maxY = Math.max(...drawables.map((d) => d.y + d.item.height));
  const pad = PAD_TILES * TILE;

  return {
    drawables,
    collisionCells,
    walkable,
    walkableList,
    bounds: { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 },
  };
}

// Rooms without a map get a plain walkable box so the game still runs (no pictures, no collision).
export function emptyTemplateMap(): TemplateMapData {
  const cols = 40;
  const rows = 24;
  const walkableList: [number, number][] = [];
  for (let x = -cols / 2; x < cols / 2; x++) {
    for (let y = -rows / 2; y < rows / 2; y++) walkableList.push([x, y]);
  }
  return {
    drawables: [],
    collisionCells: [],
    walkable: new Set(walkableList.map(([x, y]) => cellKey(x, y))),
    walkableList,
    bounds: { x: (-cols / 2) * TILE, y: (-rows / 2) * TILE, width: cols * TILE, height: rows * TILE },
  };
}

// Same contract as the old tilemap resolver: coordinates in, a spot players may stand on out.
export class TemplateWalkable {
  constructor(private readonly map: TemplateMapData) {}

  /** A random ground cell centre, used to spawn. */
  randomSpawn() {
    const list = this.map.walkableList;
    if (!list.length) {
      return new Phaser.Math.Vector2(0, 0);
    }
    const [cx, cy] = list[Math.floor(Math.random() * list.length)];
    return new Phaser.Math.Vector2(cx * TILE + TILE / 2, cy * TILE + TILE / 2);
  }

  coerce(x: number | undefined, y: number | undefined, fallback?: Phaser.Math.Vector2) {
    const base = fallback ?? this.randomSpawn();
    if (typeof x !== "number" || typeof y !== "number") return base;
    return this.findNearestWalkable(x, y) ?? base;
  }

  findNearestWalkable(worldX: number, worldY: number) {
    const startX = Math.floor(worldX / TILE);
    const startY = Math.floor(worldY / TILE);
    for (let r = 0; r <= SEARCH_RADIUS; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.map.walkable.has(cellKey(startX + dx, startY + dy))) {
            return new Phaser.Math.Vector2((startX + dx) * TILE + TILE / 2, (startY + dy) * TILE + TILE / 2);
          }
        }
      }
    }
    return undefined;
  }
}

// Layers that are not sorted with the players are painted once into big canvases (chunks) instead of one image per
// piece: separate images leave hairline gaps between neighbours when the camera zoom is not 1 or scrolls by fractions.
const CHUNK = 2048;

function bakeLayer(scene: Phaser.Scene, layerKey: string, drawables: TemplateDrawable[]) {
  const chunks = new Map<string, { cx: number; cy: number; canvas: HTMLCanvasElement }>();
  const chunkAt = (cx: number, cy: number) => {
    const key = `${cx},${cy}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      const canvas = document.createElement("canvas");
      canvas.width = CHUNK;
      canvas.height = CHUNK;
      chunk = { cx, cy, canvas };
      chunks.set(key, chunk);
    }
    return chunk;
  };

  for (const { item, x, y } of drawables) {
    for (let cx = Math.floor(x / CHUNK); cx <= Math.floor((x + item.width - 1) / CHUNK); cx++) {
      for (let cy = Math.floor(y / CHUNK); cy <= Math.floor((y + item.height - 1) / CHUNK); cy++) {
        chunkAt(cx, cy).canvas.getContext("2d")!.drawImage(item.canvas, x - cx * CHUNK, y - cy * CHUNK);
      }
    }
  }

  const depth = Math.min(...drawables.map((d) => d.depth));
  for (const { cx, cy, canvas } of chunks.values()) {
    const key = `tpl-layer:${layerKey}:${cx},${cy}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    scene.add.image(cx * CHUNK, cy * CHUNK, key).setOrigin(0, 0).setDepth(depth);
  }
}

const BLANK_KEY = "tpl-blank";

// Animated objects are never baked (a baked layer is a still picture): each one is its own image playing a looping
// animation made of the frames of its strip, with the delay of every frame from the manifest.
function addAnimated(scene: Phaser.Scene, drawable: TemplateDrawable) {
  const animation = drawable.item.animation;
  if (!animation) return;
  const textureKey = `tpl-strip:${itemKey(drawable.item)}`;
  const animKey = `tpl-anim:${itemKey(drawable.item)}`;
  if (!scene.textures.exists(textureKey)) {
    const texture = scene.textures.addCanvas(textureKey, animation.strip);
    if (texture) for (let i = 0; i < animation.frames; i++) texture.add(i, 0, i * animation.frameW, 0, animation.frameW, drawable.item.height);
  }
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: animation.delays.slice(0, animation.frames).map((duration, frame) => ({ key: textureKey, frame, duration })),
      repeat: -1,
    });
  }
  scene.add.sprite(drawable.x, drawable.y, textureKey, 0).setOrigin(0, 0).setDepth(drawable.depth).play(animKey);
}

// Adds the map to a scene: pictures, an invisible static body per collision cell. Returns the collider group.
export function buildTemplateMapInScene(scene: Phaser.Scene, map: TemplateMapData) {
  const flat = new Map<number, TemplateDrawable[]>();
  for (const drawable of map.drawables) {
    if (drawable.item.animation) {
      addAnimated(scene, drawable);
    } else if (drawable.mode === "ysort") {
      const key = `tpl:${itemKey(drawable.item)}`;
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawable.item.canvas);
      scene.add.image(drawable.x, drawable.y, key).setOrigin(0, 0).setDepth(drawable.depth);
    } else {
      const list = flat.get(drawable.layer) ?? [];
      list.push(drawable);
      flat.set(drawable.layer, list);
    }
  }
  for (const [layer, list] of flat) {
    bakeLayer(scene, String(layer), list.sort((a, b) => a.depth - b.depth));
  }

  const blocks = scene.physics.add.staticGroup();
  if (map.collisionCells.length) {
    if (!scene.textures.exists(BLANK_KEY)) scene.textures.createCanvas(BLANK_KEY, TILE, TILE);
    for (const [cx, cy] of map.collisionCells) {
      const block = blocks.create(cx * TILE + TILE / 2, cy * TILE + TILE / 2, BLANK_KEY) as Phaser.Physics.Arcade.Sprite;
      block.setVisible(false).refreshBody();
    }
  }
  return blocks;
}
