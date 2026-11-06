import { AppErrors } from '@/presentation/errors';

// Limits for the saved map JSON (format v3, see .claude/docs/map-format.md).
const MAP_DATA_VERSION = 3;
const MAX_LAYERS = 64;
const MAX_ENTRIES = 100_000;
const MAX_COORD = 100_000;
const MAX_TEXT = 200;
const LAYER_TYPES = ['art', 'collision'];
const LAYER_MODES = ['below', 'ysort', 'above'];
const REF_PATTERN = /^[owfba]:[A-Za-z0-9_]+$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCoord = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_COORD;

export function validateMapData(data: Record<string, unknown>): void {
  const fail = (reason: string): never => {
    throw AppErrors.badRequest(`Mapa invalido: ${reason}`);
  };

  if (data.version !== MAP_DATA_VERSION) fail('versao nao suportada');
  if (data.tileSize !== 32) fail('tileSize deve ser 32');
  if (!Array.isArray(data.layers) || data.layers.length === 0 || data.layers.length > MAX_LAYERS) fail('lista de camadas invalida');
  if (typeof data.activeLayer !== 'string' || data.activeLayer.length > MAX_TEXT) fail('camada ativa invalida');

  if (data.bounds !== null) {
    const bounds = data.bounds;
    if (!isObject(bounds) || !isCoord(bounds.minX) || !isCoord(bounds.minY) || !isCoord(bounds.maxX) || !isCoord(bounds.maxY)) fail('limites invalidos');
  }

  let entries = 0;
  const ids = new Set<string>();
  for (const layer of data.layers as unknown[]) {
    if (!isObject(layer)) return fail('camada invalida');
    if (typeof layer.id !== 'string' || !layer.id || layer.id.length > MAX_TEXT || ids.has(layer.id)) fail('id de camada invalido');
    ids.add(layer.id as string);
    if (typeof layer.name !== 'string' || layer.name.length > MAX_TEXT) fail('nome de camada invalido');
    if (!LAYER_TYPES.includes(layer.type as string)) fail('tipo de camada invalido');
    if (!LAYER_MODES.includes(layer.mode as string)) fail('modo de camada invalido');
    if (layer.floor !== undefined && typeof layer.floor !== 'boolean') fail('flag de chao invalida');
    if (typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean') fail('flags de camada invalidas');

    if (layer.type === 'collision') {
      const cells = layer.cells;
      if (!Array.isArray(cells)) return fail('colisao sem celulas');
      entries += cells.length;
      if (entries > MAX_ENTRIES) fail('itens demais');
      for (const cell of cells) {
        if (!Array.isArray(cell) || cell.length !== 2 || !isCoord(cell[0]) || !isCoord(cell[1])) fail('celula invalida');
      }
    } else {
      const items = layer.items;
      if (!Array.isArray(items)) return fail('camada sem itens');
      entries += items.length;
      if (entries > MAX_ENTRIES) fail('itens demais');
      for (const item of items) {
        if (!Array.isArray(item) || (item.length !== 3 && item.length !== 4) || typeof item[0] !== 'string' || item[0].length > MAX_TEXT || !REF_PATTERN.test(item[0]) || !isCoord(item[1]) || !isCoord(item[2]) || (item.length === 4 && item[3] !== 1)) {
          fail('item invalido');
        }
      }
    }
  }
}
