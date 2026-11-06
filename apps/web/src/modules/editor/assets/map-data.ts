// Saved map format (v3). See .claude/docs/map-format.md. Sparse, ids only, layers bottom to top.
import type { ItemKind } from "./map-assets";
import type { LayerMode, LayerType, MapLayer } from "./map-layers";

export const MAP_DATA_VERSION = 3;

export type MapItemRef = [ref: string, x: number, y: number];
export type MapDataLayer = MapLayer & { items?: MapItemRef[]; cells?: [number, number][] };
export type MapBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type MapData = {
  version: typeof MAP_DATA_VERSION;
  tileSize: number;
  bounds: MapBounds | null;
  layers: MapDataLayer[];
  activeLayer: string;
};

// A placed thing as the editor scene tracks it; `seq` is the placement order.
export type PlacedRecord = { kind: ItemKind | "collision"; id: string; x: number; y: number; layer: string; seq: number };

const KIND_PREFIX: Record<ItemKind, string> = { object: "o", animated: "a", wall: "w", floor: "f", border: "b" };
const PREFIX_KIND: Record<string, ItemKind> = { o: "object", a: "animated", w: "wall", f: "floor", b: "border" };

// Size in tiles of a placed record, for the bounds (the real size lives in the atlas, so the base cell is used).
function footprint(_rec: PlacedRecord) {
  return { w: 1, h: 1 };
}

export function serializeMap(layers: MapLayer[], records: PlacedRecord[], activeId: string): MapData {
  const firstArt = (layers.find((layer) => layer.type === "art") ?? layers[0]).id;
  const known = new Set(layers.map((layer) => layer.id));
  const ordered = [...records].sort((a, b) => a.seq - b.seq);
  const bounds: MapBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  const dataLayers = layers.map((layer): MapDataLayer => {
    const mine = ordered.filter((rec) => (known.has(rec.layer) ? rec.layer : firstArt) === layer.id);
    for (const rec of mine) {
      const { w, h } = footprint(rec);
      bounds.minX = Math.min(bounds.minX, rec.x);
      bounds.minY = Math.min(bounds.minY, rec.y);
      bounds.maxX = Math.max(bounds.maxX, rec.x + w - 1);
      bounds.maxY = Math.max(bounds.maxY, rec.y + h - 1);
    }
    return layer.type === "collision"
      ? { ...layer, cells: mine.filter((rec) => rec.kind === "collision").map((rec): [number, number] => [rec.x, rec.y]) }
      : {
          ...layer,
          items: mine.filter((rec) => rec.kind !== "collision").map((rec): MapItemRef => [`${KIND_PREFIX[rec.kind as ItemKind]}:${rec.id}`, rec.x, rec.y]),
        };
  });

  return {
    version: MAP_DATA_VERSION,
    tileSize: 32,
    bounds: Number.isFinite(bounds.minX) ? bounds : null,
    layers: dataLayers,
    activeLayer: activeId,
  };
}

export type ParsedMap = {
  /** null: the file has no layer list (version 1), use the defaults */
  layers: MapLayer[] | null;
  activeId?: string;
  /** In placement order. `layer` is "" for version 1 records (the scene picks one). */
  records: Omit<PlacedRecord, "seq">[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parseLayer(raw: unknown): MapLayer | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const type: LayerType = raw.type === "collision" ? "collision" : "art";
  const floor = type === "art" && (raw.floor === true || raw.id === "floor");
  // Depth is no longer a choice: floor and wall sit under everything, every other art layer sorts with the players by Y (collision is never drawn).
  const mode: LayerMode = type === "art" && !floor && raw.id !== "wall" ? "ysort" : "below";
  const layer: MapLayer = { id: raw.id, name: typeof raw.name === "string" ? raw.name : raw.id, type, mode, visible: raw.visible !== false, locked: raw.locked === true };
  // The Floor layer is always the ground (older saves may lack the flag).
  if (floor) layer.floor = true;
  return layer;
}

// Reads a saved map of any version (3 from the database or a draft, 2 and 1 from the first local tests).
export function parseMap(raw: unknown): ParsedMap | null {
  if (!isRecord(raw)) return null;

  if (raw.version === MAP_DATA_VERSION && Array.isArray(raw.layers)) {
    const layers: MapLayer[] = [];
    const records: ParsedMap["records"] = [];
    for (const rawLayer of raw.layers) {
      const layer = parseLayer(rawLayer);
      if (!layer || !isRecord(rawLayer)) continue;
      layers.push(layer);
      if (Array.isArray(rawLayer.cells)) {
        for (const cell of rawLayer.cells) {
          if (Array.isArray(cell) && isNumber(cell[0]) && isNumber(cell[1])) records.push({ kind: "collision", id: "", x: cell[0], y: cell[1], layer: layer.id });
        }
      }
      if (Array.isArray(rawLayer.items)) {
        for (const item of rawLayer.items) {
          if (!Array.isArray(item) || typeof item[0] !== "string" || !isNumber(item[1]) || !isNumber(item[2])) continue;
          const split = item[0].indexOf(":");
          const kind = PREFIX_KIND[item[0].slice(0, split)];
          if (kind) records.push({ kind, id: item[0].slice(split + 1), x: item[1], y: item[2], layer: layer.id });
        }
      }
    }
    return layers.length ? { layers, activeId: typeof raw.activeLayer === "string" ? raw.activeLayer : undefined, records } : null;
  }

  if (Array.isArray(raw.placed)) {
    const hasLayers = raw.version === 2 && Array.isArray(raw.layers);
    const layers = hasLayers ? (raw.layers as unknown[]).map(parseLayer).filter((layer): layer is MapLayer => layer !== null) : null;
    const ordered = (raw.placed as unknown[])
      .map((rec, index) => ({ rec, order: isRecord(rec) && isNumber(rec.seq) ? rec.seq : index }))
      .sort((a, b) => a.order - b.order);
    const records: ParsedMap["records"] = [];
    for (const { rec } of ordered) {
      if (!isRecord(rec) || !isNumber(rec.x) || !isNumber(rec.y) || typeof rec.id !== "string") continue;
      const kind = rec.kind === "collision" || rec.kind === "object" || rec.kind === "animated" || rec.kind === "wall" || rec.kind === "floor" || rec.kind === "border" ? rec.kind : null;
      if (kind) records.push({ kind, id: rec.id, x: rec.x, y: rec.y, layer: typeof rec.layer === "string" ? rec.layer : "" });
    }
    return {
      layers: layers?.length ? layers : null,
      activeId: typeof raw.activeId === "string" ? raw.activeId : undefined,
      records,
    };
  }

  return null;
}
