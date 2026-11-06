// Pure helpers (no imports) so the migration can reuse them too.

export const USERNAME_MAX_LENGTH = 30;
const USERNAME_MIN_LENGTH = 3;
// Leaves room for the `_123456` suffix added on collisions.
const USERNAME_BASE_MAX_LENGTH = 22;

/** Lowercase, no accents, only a-z 0-9 and `_`, at least 3 chars. */
export function normalizeUsername(value: string): string {
  const cleaned = (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  const base = cleaned.length >= USERNAME_MIN_LENGTH ? cleaned : cleaned ? `user_${cleaned}` : 'user';
  return base.slice(0, USERNAME_BASE_MAX_LENGTH).replace(/_+$/g, '') || 'user';
}

/** `joao.roberto+dev@gmail.com` -> `joao_roberto` (the part before `@`, without a `+tag`). */
export function usernameBaseFromEmail(email: string): string {
  const localPart = (email ?? '').split('@')[0].split('+')[0];
  return normalizeUsername(localPart);
}

/** `joao` then `joao_1`, `joao_2`, ... */
export function usernameCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}_${attempt}`;
}

/** Picks the first free candidate; after many collisions falls back to a random suffix. */
export async function generateUniqueUsername(
  email: string,
  isTaken: (username: string) => Promise<boolean>,
): Promise<string> {
  const base = usernameBaseFromEmail(email);

  for (let attempt = 0; attempt <= 50; attempt++) {
    const candidate = usernameCandidate(base, attempt);
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  for (;;) {
    const candidate = `${base}_${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }
}
