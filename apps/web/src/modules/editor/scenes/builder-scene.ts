import * as Phaser from "phaser";
import { TILE, getItem, itemKey, type Brush, type MapItem } from "../assets/map-assets";
import { isProtectedLayer, newLayerId, type LayerController, type LayerState, type LayerType, type MapLayer } from "../assets/map-layers";
import { parseMap, serializeMap, type MapData, type PlacedRecord } from "../assets/map-data";

export const BUILDER_SCENE_KEY = "builder";
export { TILE as TILE_SIZE };
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
// Each layer owns a band of depth; inside it items sort by placement order or (ysort) by bottom edge.
const LAYER_BAND = 2_000_000;
const BAND_OFFSET = 500_000;
const TOP_DEPTH = 9_000_000_000;
const COLLISION_COLOR = 0xef4444;
const PROTECTED = ["floor", "wall"];

export type CursorTile = { x: number; y: number } | null;

export type BuilderSceneOptions = {
  /** The map as stored in the database (any saved version), or empty for a new map. */
  initialData?: unknown;
  /** Layers of a brand-new map, bottom to top. */
  defaultLayers: MapLayer[];
  onCursorChange?: (tile: CursorTile) => void;
  /** The creator dropped the brush with Esc. */
  onBrushClear?: () => void;
  onLayersChange?: (state: LayerState) => void;
  /** True once something changed since the last save (or a draft was found). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Whether there is something to undo / redo. */
  onHistoryChange?: (state: HistoryState) => void;
};

export type HistoryState = { canUndo: boolean; canRedo: boolean };
const MAX_HISTORY = 100;

/** What the page uses: layer editing plus reading the map to save it. */
export interface BuilderController extends LayerController {
  serialize(): MapData;
  markSaved(): void;
  undo(): void;
  redo(): void;
}

type Placed = PlacedRecord;
type Visual = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
type Entry = { rec: Placed; item: MapItem | null; visual: Visual };
// The whole editable state, taken before each action (a drag stroke counts as one action).
type Snapshot = { layers: MapLayer[]; activeId: string; entries: { rec: Placed; item: MapItem | null }[] };

// Map-building canvas: black background, an endless 32px grid whose origin (0,0) is the map centre, a stack of layers
// and a brush that follows the mouse. Left click places on the active layer, right click erases from it, middle button
// (or Space + drag) pans. See .claude/docs/map-layers.md.
export class BuilderScene extends Phaser.Scene implements BuilderController {
  private grid!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Rectangle;
  private originLabel!: Phaser.GameObjects.Text;
  private ghost: Phaser.GameObjects.Image[] = [];
  private brush: Brush | null = null;
  private entries = new Map<string, Entry>();
  private layers: MapLayer[];
  private activeId: string;
  private seq = 0;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private lastView = "";
  private lastTile: CursorTile = null;
  private lastActionCell = "";
  private ready = false;
  private closed = false;
  private dirty = false;
  private pending: Placed[] = [];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private strokeOpen = false;
  // Animated object under the mouse: it plays its frames while hovered and goes back to frame 0 when left.
  private playing: { entry: Entry; frame: number; until: number } | null = null;

  constructor(private readonly options: BuilderSceneOptions) {
    super(BUILDER_SCENE_KEY);
    this.layers = options.defaultLayers.map((layer) => ({ ...layer }));
    this.activeId = (this.layers.find((layer) => layer.type === "art") ?? this.layers[0]).id;
  }

  create() {
    const camera = this.cameras.main;
    camera.setBackgroundColor("#000000");
    camera.centerOn(0, 0);

    this.input.mouse?.disableContextMenu();
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.brush) return;
      this.setBrush(null);
      this.options.onBrushClear?.();
    });

    this.grid = this.add.graphics().setDepth(0);
    this.originLabel = this.add.text(6, 6, "0,0 · centro", { fontSize: "12px", color: "#7dd3fc" }).setDepth(TOP_DEPTH - 2);
    this.hover = this.add
      .rectangle(0, 0, TILE, TILE, 0x38bdf8, 0.2)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x7dd3fc, 1)
      .setDepth(TOP_DEPTH - 1)
      .setVisible(false);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer, true));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.lastActionCell = "";
      this.strokeOpen = false;
      this.handlePointer(pointer, false);
    });
    this.input.on("wheel", this.handleWheel, this);
    this.input.on("gameout", () => this.setCursorTile(null));

    // Save a pending change when the page is left (the game is destroyed on unmount).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.flush());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.flush());

    this.ready = true;
    this.restore();
    this.rebuildGhost();
    this.emitLayers();
  }

  /** Called from React: the item(s) now stuck to the mouse, or null for none. */
  setBrush(brush: Brush | null) {
    this.brush = brush;
    if (this.ready) this.rebuildGhost();
  }

  // ---- layer stack (LayerController) ----

  setActiveLayer(id: string) {
    if (!this.layers.some((layer) => layer.id === id)) return;
    this.activeId = id;
    this.rebuildGhost();
    this.changed();
  }

  addLayer(type: LayerType, name: string) {
    this.checkpoint();
    const layer: MapLayer = { id: newLayerId(), name, type, mode: type === "art" ? "ysort" : "below", visible: true, locked: false };
    // New layers go right above the active one.
    const at = this.layers.findIndex((item) => item.id === this.activeId);
    this.layers.splice(at + 1, 0, layer);
    this.activeId = layer.id;
    this.refreshDepths();
    this.rebuildGhost();
    this.changed();
  }

  renameLayer(id: string, name: string) {
    const layer = this.layers.find((item) => item.id === id);
    if (!layer || !name.trim()) return;
    this.checkpoint();
    layer.name = name.trim();
    this.changed();
  }

  updateLayer(id: string, patch: Partial<Pick<MapLayer, "mode" | "visible" | "locked">>) {
    const layer = this.layers.find((item) => item.id === id);
    if (!layer) return;
    this.checkpoint();
    Object.assign(layer, patch);
    for (const entry of this.entries.values()) {
      if (entry.rec.layer === id) entry.visual.setVisible(layer.visible);
    }
    this.refreshDepths();
    this.changed();
  }

  moveLayer(id: string, direction: 1 | -1) {
    const from = this.layers.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= this.layers.length) return;
    this.checkpoint();
    [this.layers[from], this.layers[to]] = [this.layers[to], this.layers[from]];
    this.refreshDepths();
    this.changed();
  }

  removeLayer(id: string) {
    if (this.layers.length <= 1) return;
    if (PROTECTED.includes(id)) return;
    const index = this.layers.findIndex((item) => item.id === id);
    if (index < 0) return;
    this.checkpoint();
    for (const [key, entry] of [...this.entries]) {
      if (entry.rec.layer === id) this.removeEntry(key);
    }
    this.pending = this.pending.filter((rec) => rec.layer !== id);
    this.layers.splice(index, 1);
    if (this.activeId === id) this.activeId = this.layers[Math.min(index, this.layers.length - 1)].id;
    this.rebuildGhost();
    this.changed();
  }

  private get activeLayer() {
    return this.layers.find((layer) => layer.id === this.activeId)!;
  }

  private changed() {
    this.emitLayers();
    this.markChanged();
  }

  private emitLayers() {
    this.options.onLayersChange?.({ layers: this.layers.map((layer) => ({ ...layer })), activeId: this.activeId });
  }

  private depthOf(entry: Entry) {
    const index = this.layers.findIndex((layer) => layer.id === entry.rec.layer);
    const base = index * LAYER_BAND + BAND_OFFSET;
    if (entry.item && this.layers[index]?.mode === "ysort") return base + entry.visual.y + entry.item.height;
    return base + entry.rec.seq;
  }

  private refreshDepths() {
    for (const entry of this.entries.values()) entry.visual.setDepth(this.depthOf(entry));
  }

  // ---- grid and camera ----

  update(time: number) {
    this.stepAnimation(time);
    const view = this.cameras.main.worldView;
    const key = `${view.x}|${view.y}|${view.width}|${view.height}|${this.cameras.main.zoom}`;
    if (key === this.lastView) return;
    this.lastView = key;
    this.drawGrid();
  }

  private drawGrid() {
    const camera = this.cameras.main;
    const view = camera.worldView;
    // Zoomed far out, draw only every 4th line so the grid stays readable.
    const step = TILE * (camera.zoom < 0.5 ? 4 : 1);
    const startX = Math.floor(view.x / step) * step;
    const startY = Math.floor(view.y / step) * step;
    const endX = view.right;
    const endY = view.bottom;

    this.grid.clear();
    this.grid.lineStyle(1 / camera.zoom, 0xffffff, 0.14);
    for (let x = startX; x <= endX; x += step) this.grid.lineBetween(x, view.y, x, endY);
    for (let y = startY; y <= endY; y += step) this.grid.lineBetween(view.x, y, endX, y);

    // Origin axes: the crossing is the centre of the map (tile 0,0).
    this.grid.lineStyle(2 / camera.zoom, 0x38bdf8, 0.6);
    this.grid.lineBetween(0, view.y, 0, endY);
    this.grid.lineBetween(view.x, 0, endX, 0);
    this.grid.fillStyle(0x38bdf8, 1);
    this.grid.fillCircle(0, 0, 5 / camera.zoom);
    this.originLabel.setScale(1 / camera.zoom).setPosition(8 / camera.zoom, 8 / camera.zoom);
  }

  private cellOf(pointer: Phaser.Input.Pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
  }

  private handlePointer(pointer: Phaser.Input.Pointer, isMove: boolean) {
    const camera = this.cameras.main;
    const cell = this.cellOf(pointer);
    const panning = pointer.middleButtonDown() || (Boolean(this.spaceKey?.isDown) && pointer.leftButtonDown());

    if (panning) {
      if (isMove) {
        camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
        camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
      }
    } else {
      const cellKey = `${cell.x},${cell.y}`;
      if (cellKey !== this.lastActionCell) {
        if (pointer.rightButtonDown()) {
          this.lastActionCell = cellKey;
          this.erase(cell.x, cell.y);
        } else if (pointer.leftButtonDown()) {
          this.lastActionCell = cellKey;
          this.place(cell.x, cell.y);
        }
      }
    }

    this.setCursorTile(cell);
  }

  private handleWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) {
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    camera.setZoom(Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
    camera.preRender();
    // Keep the tile under the mouse in place while zooming.
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    this.handlePointer(pointer, true);
  }

  // ---- brush ghost and hover ----

  private ensureTexture(item: MapItem) {
    const key = itemKey(item);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, item.canvas);
    return key;
  }

  // Animated objects are drawn from a texture holding all their frames.
  private ensureStrip(item: MapItem) {
    const key = `strip:${itemKey(item)}`;
    if (!this.textures.exists(key) && item.animation) {
      const texture = this.textures.addCanvas(key, item.animation.strip);
      if (texture) for (let i = 0; i < item.animation.frames; i++) texture.add(i, 0, i * item.animation.frameW, 0, item.animation.frameW, item.height);
    }
    return key;
  }

  private animatedAt(cell: CursorTile) {
    if (!cell) return null;
    const px = cell.x * TILE + TILE / 2;
    const py = cell.y * TILE + TILE / 2;
    let top: Entry | null = null;
    for (const entry of this.entries.values()) {
      if (!entry.item?.animation || !entry.visual.visible) continue;
      const { x, y } = entry.visual;
      if (px < x || px >= x + entry.item.width || py < y || py >= y + entry.item.height) continue;
      if (!top || entry.visual.depth > top.visual.depth) top = entry;
    }
    return top;
  }

  private setPlaying(entry: Entry | null) {
    if (this.playing?.entry === entry) return;
    if (this.playing) (this.playing.entry.visual as Phaser.GameObjects.Image).setFrame(0);
    this.playing = entry ? { entry, frame: 0, until: 0 } : null;
  }

  private stepAnimation(time: number) {
    const playing = this.playing;
    const animation = playing?.entry.item?.animation;
    if (!playing || !animation) return;
    if (time < playing.until) return;
    const image = playing.entry.visual as Phaser.GameObjects.Image;
    image.setFrame(playing.frame);
    playing.until = time + (animation.delays[playing.frame] ?? 100);
    playing.frame = (playing.frame + 1) % animation.frames;
  }

  private rebuildGhost() {
    this.ghost.forEach((image) => image.destroy());
    this.ghost = [];
    const collision = this.activeLayer.type === "collision";
    if (this.brush && !collision) {
      this.ghost = this.brush.items.map(({ item }) => this.add.image(0, 0, this.ensureTexture(item)).setOrigin(0, 0).setAlpha(0.65).setDepth(TOP_DEPTH));
      this.hover.setSize(this.brush.width * TILE, this.brush.height * TILE);
    } else {
      this.hover.setSize(TILE, TILE);
    }
    // A collision layer paints red cells instead of using the brush.
    this.hover.setFillStyle(collision ? COLLISION_COLOR : 0x38bdf8, collision ? 0.4 : 0.2);
    this.hover.setStrokeStyle(1, collision ? 0xfca5a5 : 0x7dd3fc, 1);
    this.moveGhost(this.lastTile);
  }

  private moveGhost(tile: CursorTile) {
    if (!tile) {
      this.ghost.forEach((image) => image.setVisible(false));
      return;
    }
    this.brush?.items.forEach(({ item, dx, dy }, index) => {
      this.ghost[index]?.setPosition((tile.x + dx) * TILE + item.offsetX, (tile.y + dy) * TILE + item.offsetY).setVisible(true);
    });
  }

  private setCursorTile(tile: CursorTile) {
    if (tile) this.hover.setPosition(tile.x * TILE, tile.y * TILE).setVisible(true);
    else this.hover.setVisible(false);
    this.moveGhost(tile);

    if (tile?.x === this.lastTile?.x && tile?.y === this.lastTile?.y) return;
    this.lastTile = tile;
    this.setPlaying(this.animatedAt(tile));
    this.options.onCursorChange?.(tile);
  }

  // ---- painting ----

  private canEdit(layer: MapLayer) {
    return layer.visible && !layer.locked;
  }

  private place(cellX: number, cellY: number) {
    const layer = this.activeLayer;
    if (!this.canEdit(layer)) return;
    if (layer.type === "collision") {
      this.checkpointStroke();
      this.addCollision(layer.id, cellX, cellY);
    } else if (this.brush) {
      this.checkpointStroke();
      for (const { item, dx, dy } of this.brush.items) this.addItem(layer.id, item, cellX + dx, cellY + dy, ++this.seq);
    } else {
      return;
    }
    this.markChanged();
  }

  private entryKey(layerId: string, kind: string, id: string, x: number, y: number) {
    return kind === "tile" || kind === "collision" ? `${kind}:${layerId}:${x},${y}` : `o:${layerId}:${id}@${x},${y}`;
  }

  private addItem(layerId: string, item: MapItem, x: number, y: number, seq: number) {
    const key = this.entryKey(layerId, item.kind, item.id, x, y);
    this.removeEntry(key);

    const visual = item.animation
      ? this.add.image(x * TILE + item.offsetX, y * TILE + item.offsetY, this.ensureStrip(item), 0).setOrigin(0, 0)
      : this.add.image(x * TILE + item.offsetX, y * TILE + item.offsetY, this.ensureTexture(item)).setOrigin(0, 0);
    const entry: Entry = { rec: { kind: item.kind, id: item.id, x, y, layer: layerId, seq }, item, visual };
    this.register(key, entry);
  }

  private addCollision(layerId: string, x: number, y: number, seq = ++this.seq) {
    const key = this.entryKey(layerId, "collision", "", x, y);
    this.removeEntry(key);

    const visual = this.add.rectangle(x * TILE, y * TILE, TILE, TILE, COLLISION_COLOR, 0.4).setOrigin(0, 0);
    this.register(key, { rec: { kind: "collision", id: "", x, y, layer: layerId, seq }, item: null, visual });
  }

  private register(key: string, entry: Entry) {
    const layer = this.layers.find((item) => item.id === entry.rec.layer);
    entry.visual.setVisible(layer?.visible ?? true);
    entry.visual.setDepth(this.depthOf(entry));
    this.entries.set(key, entry);
  }

  private removeEntry(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.playing?.entry === entry) this.playing = null;
    entry.visual.destroy();
    this.entries.delete(key);
    return true;
  }

  // Right click: removes the front-most thing of the active layer under the cell (a block of objects or a tile).
  private erase(cellX: number, cellY: number) {
    const layer = this.activeLayer;
    if (!this.canEdit(layer)) return;

    const cellLeft = cellX * TILE;
    const cellTop = cellY * TILE;
    let top: { key: string; depth: number } | null = null;
    for (const [key, entry] of this.entries) {
      if (entry.rec.layer !== layer.id) continue;
      const { x, y } = entry.visual;
      const width = entry.item?.width ?? TILE;
      const height = entry.item?.height ?? TILE;
      const covers = x < cellLeft + TILE && x + width > cellLeft && y < cellTop + TILE && y + height > cellTop;
      if (covers && (!top || entry.visual.depth > top.depth)) top = { key, depth: entry.visual.depth };
    }
    if (top) {
      this.checkpointStroke();
      if (this.removeEntry(top.key)) this.markChanged();
    }
  }

  // ---- undo / redo ----

  private snapshot(): Snapshot {
    return {
      layers: this.layers.map((layer) => ({ ...layer })),
      activeId: this.activeId,
      entries: [...this.entries.values()].map((entry) => ({ rec: { ...entry.rec }, item: entry.item })),
    };
  }

  private emitHistory() {
    this.options.onHistoryChange?.({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 });
  }

  /** Call right before something changes. */
  private checkpoint() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.emitHistory();
  }

  // One checkpoint per mouse stroke, however many cells it paints or erases.
  private checkpointStroke() {
    if (this.strokeOpen) return;
    this.strokeOpen = true;
    this.checkpoint();
  }

  private applySnapshot(snapshot: Snapshot) {
    this.playing = null;
    for (const entry of this.entries.values()) entry.visual.destroy();
    this.entries.clear();
    this.layers = snapshot.layers.map((layer) => ({ ...layer }));
    this.activeId = snapshot.activeId;
    for (const { rec, item } of snapshot.entries) {
      if (item) this.addItem(rec.layer, item, rec.x, rec.y, rec.seq);
      else this.addCollision(rec.layer, rec.x, rec.y, rec.seq);
    }
    this.refreshDepths();
    this.rebuildGhost();
    this.emitLayers();
    this.markChanged();
    this.emitHistory();
  }

  undo() {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.snapshot());
    this.strokeOpen = false;
    this.applySnapshot(previous);
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.strokeOpen = false;
    this.applySnapshot(next);
  }

  // ---- saving ----
  // The database copy is written by the page (Save button, see serialize/markSaved). There is no local draft: the
  // map opens from the database and unsaved changes are only guarded by the page's leave confirmation.

  /** The whole map in the saved format (v3). */
  serialize(): MapData {
    const records = [...this.entries.values()].map((entry) => entry.rec).concat(this.pending);
    return serializeMap(this.layers, records, this.activeId);
  }

  /** The page saved the current state to the database: nothing is unsaved anymore. */
  markSaved() {
    this.setDirty(false);
  }

  private setDirty(dirty: boolean) {
    if (this.dirty === dirty) return;
    this.dirty = dirty;
    this.options.onDirtyChange?.(dirty);
  }

  private markChanged() {
    this.setDirty(true);
  }

  // Floor and Wall always exist: a saved map that lost them (older saves) gets them back at the bottom.
  private withProtectedLayers(layers: MapLayer[]) {
    const result = [...layers];
    const defaults = this.options.defaultLayers.filter(isProtectedLayer);
    let at = 0;
    for (const layer of defaults) {
      if (!result.some((item) => item.id === layer.id)) result.splice(at, 0, { ...layer });
      at = result.findIndex((item) => item.id === layer.id) + 1;
    }
    return result;
  }

  private restore() {
    const source = parseMap(this.options.initialData);
    if (!source) return;
    if (source.layers?.length) {
      this.layers = this.withProtectedLayers(source.layers);
      this.activeId = source.layers.some((layer) => layer.id === source.activeId) ? (source.activeId as string) : source.layers[0].id;
    }

    const fallbackLayer = (this.layers.find((layer) => layer.type === "art") ?? this.layers[0]).id;
    const known = new Set(this.layers.map((layer) => layer.id));
    const records: Placed[] = source.records.map((rec, index) => ({ ...rec, seq: index + 1 }));
    this.seq = records.length;

    for (const rec of records) {
      if (rec.kind === "collision") {
        const layer = known.has(rec.layer) ? rec.layer : this.layers.find((item) => item.type === "collision")?.id;
        if (layer) this.addCollision(layer, rec.x, rec.y, rec.seq);
        continue;
      }
      this.pending.push(rec);
      getItem(rec.kind, rec.id)
        .then((item) => {
          this.pending = this.pending.filter((entry) => entry !== rec);
          if (this.closed) return;
          // Version 1 saves had no layers: tiles go to floor/wall by category, blocks to objects.
          const legacy = item.layer === "floor" ? "floor" : item.layer === "wall" ? "wall" : "objects";
          const layerId = known.has(rec.layer) ? rec.layer : known.has(legacy) ? legacy : fallbackLayer;
          this.addItem(layerId, item, rec.x, rec.y, rec.seq);
        })
        .catch(() => {
          this.pending = this.pending.filter((entry) => entry !== rec);
        });
    }
  }

  private flush() {
    this.closed = true;
  }
}
