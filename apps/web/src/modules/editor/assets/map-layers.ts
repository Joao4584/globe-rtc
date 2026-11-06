// Layer model of the map editor. See .claude/docs/map-layers.md.

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
  /** Art layers only: where this layer has tiles is ground where players can walk and spawn. */
  floor?: boolean;
};

// Layers listed bottom to top (the last one is drawn on top).
export type LayerState = { layers: MapLayer[]; activeId: string };

export type LayerNames = { floor: string; wall: string; objects: string; above: string; collision: string };

// Mirrors the five layers of the example map (floor, wall, blocks, wall-top, collider).
export function defaultLayers(names: LayerNames): MapLayer[] {
  const base = { visible: true, locked: false };
  return [
    { id: "floor", name: names.floor, type: "art", mode: "below", floor: true, ...base },
    { id: "wall", name: names.wall, type: "art", mode: "below", ...base },
    { id: "objects", name: names.objects, type: "art", mode: "ysort", ...base },
    { id: "above", name: names.above, type: "art", mode: "above", ...base },
    { id: "collision", name: names.collision, type: "collision", mode: "below", ...base },
  ];
}

export const newLayerId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// What the page can do to the layer stack (implemented by the builder scene).
export interface LayerController {
  setActiveLayer(id: string): void;
  addLayer(type: LayerType, name: string): void;
  renameLayer(id: string, name: string): void;
  updateLayer(id: string, patch: Partial<Pick<MapLayer, "mode" | "visible" | "locked" | "floor">>): void;
  /** direction 1 = towards the top of the stack, -1 = towards the bottom */
  moveLayer(id: string, direction: 1 | -1): void;
  removeLayer(id: string): void;
}
