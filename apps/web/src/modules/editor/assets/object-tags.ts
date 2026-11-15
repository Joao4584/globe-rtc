// Flags of an asset (not of one placed copy): every copy of the object carries them. They live in
// apps/web/public/object-tags.json, keyed by object id (`o:` and `a:` ids never collide), and are fetched at runtime (not
// bundled: the dev route below rewrites the file and the bundler's hot reload does not like that). In development the
// editor can edit them (see app/api/dev/object-tags/route.ts).
export const SEAT_FACINGS = ["down", "up", "left", "right"] as const;
export type SeatFacing = (typeof SEAT_FACINGS)[number];

/** `sittable`: a player walking into it sits on it. `facing`: where the person looks while sitting. */
export type ObjectTag = { sittable: true; facing: SeatFacing };

let loaded: Promise<Map<string, ObjectTag>> | undefined;

export function loadObjectTags(): Promise<Map<string, ObjectTag>> {
  loaded ??= fetch("/object-tags.json", { cache: "no-cache" })
    .then((response) => (response.ok ? (response.json() as Promise<Record<string, ObjectTag>>) : {}))
    .catch(() => ({}) as Record<string, ObjectTag>)
    .then((tags) => new Map(Object.entries(tags)));
  return loaded;
}

/** Sets (or clears, with `null`) the tag of an asset. Returns false when the file could not be written. */
export async function setObjectTag(id: string, tag: ObjectTag | null): Promise<boolean> {
  try {
    const response = await fetch("/api/dev/object-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tag }),
    });
    if (!response.ok) return false;
  } catch {
    return false;
  }
  const tags = await loadObjectTags();
  if (tag) tags.set(id, tag);
  else tags.delete(id);
  return true;
}
