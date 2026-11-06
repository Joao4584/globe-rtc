// Layer model of the map editor. See .claude/docs/map-layers.md.
import type { ItemKind } from "./map-assets";

export type LayerType = "art" | "collision";
// How an art layer relates to players in the game: always under, sorted with them by y, or always over.
export type LayerMode = "below" | "ysort" | "above";

export type MapLayer = {
  id: string;
  name: string;
  type: LayerType;
  mode: LayerMode;
  visible: boolean;
  locked: boolean;
  /** Set on the Floor layer only: where it has tiles is ground where players can walk and spawn. */
  floor?: boolean;
};

// Layers listed bottom to top (the last one is drawn on top).
export type LayerState = { layers: MapLayer[]; activeId: string };

export type LayerNames = { floor: string; wall: string; objects: string; collision: string };

// Every map has a Floor (where players walk and spawn) and a Wall layer; they cannot be removed. Objects and the rest can.
export const PROTECTED_LAYER_IDS = ["floor", "wall"];
export const isProtectedLayer = (layer: Pick<MapLayer, "id">) => PROTECTED_LAYER_IDS.includes(layer.id);

// A new map starts with floor, wall, objects (sorted with players by y) and collision.
export function defaultLayers(names: LayerNames): MapLayer[] {
  const base = { visible: true, locked: false };
  return [
    { id: "floor", name: names.floor, type: "art", mode: "below", floor: true, ...base },
    { id: "wall", name: names.wall, type: "art", mode: "below", ...base },
    { id: "objects", name: names.objects, type: "art", mode: "ysort", ...base },
    { id: "collision", name: names.collision, type: "collision", mode: "below", ...base },
  ];
}

export const newLayerId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// What the page can do to the layer stack (implemented by the builder scene).
export interface LayerController {
  setActiveLayer(id: string): void;
  addLayer(type: LayerType, name: string): void;
  renameLayer(id: string, name: string): void;
  updateLayer(id: string, patch: Partial<Pick<MapLayer, "mode" | "visible" | "locked">>): void;
  /** direction 1 = towards the top of the stack, -1 = towards the bottom */
  moveLayer(id: string, direction: 1 | -1): void;
  removeLayer(id: string): void;
}

// What each layer takes: Floor only floor pieces, Wall only wall pieces (borders go with both), any other art layer only
// objects and animated objects. Collision layers take no pieces (they paint cells).
export type LayerAccepts = "floor" | "wall" | "objects";
export const layerAccepts = (layer: Pick<MapLayer, "id">): LayerAccepts => (layer.id === "floor" ? "floor" : layer.id === "wall" ? "wall" : "objects");

export function acceptsKind(layer: Pick<MapLayer, "id" | "type">, kind: ItemKind): boolean {
  if (layer.type === "collision") return false;
  const accepts = layerAccepts(layer);
  if (accepts === "floor") return kind === "floor" || kind === "border";
  if (accepts === "wall") return kind === "wall" || kind === "border";
  return kind === "object" || kind === "animated";
}
