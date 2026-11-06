import { loadCatalog, partsFor, SkinPart, SkinSelection } from '@globe-rtc/skin-generator';
import { AppErrors } from '@/presentation/errors';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Turns anything a client sent into a `SkinSelection`, checking that every piece exists in the installed pack.
 * Throws a 400 for anything else. Parts a type does not have (kids have no accessory) are forced to `null`.
 */
export async function parseSkinSelection(raw: unknown): Promise<SkinSelection> {
  if (!isObject(raw)) throw AppErrors.badRequest('`selection` must be an object.');
  if (raw.type !== 'adult' && raw.type !== 'kid') throw AppErrors.badRequest('`selection.type` must be "adult" or "kid".');

  const type = raw.type;
  const catalog = await loadCatalog();
  const available = partsFor(type);
  const selection: SkinSelection = { type, body: '', eyes: '', outfit: '', hairstyle: null, accessory: null };

  for (const part of available as SkinPart[]) {
    const value = raw[part];
    const optional = part === 'hairstyle' || part === 'accessory';
    if (value === null || value === undefined) {
      if (!optional) throw AppErrors.badRequest(`\`selection.${part}\` is required.`);
      continue;
    }
    if (typeof value !== 'string' || !(catalog[type][part] ?? []).includes(value)) {
      throw AppErrors.badRequest(`Unknown ${part} piece for ${type}.`);
    }
    (selection as unknown as Record<string, string | null>)[part] = value;
  }
  return selection;
}
