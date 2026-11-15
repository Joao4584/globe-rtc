import registry from "../../../../assets-registry/object-tags.json";

// Flags of an asset (not of one placed copy): every copy of the object carries them. They live in
// apps/web/assets-registry/object-tags.json, keyed by object id (`o:` and `a:` ids never collide), and are bundled with
// the web app. In development the editor can edit them (see app/api/dev/object-tags/route.ts).
export const SEAT_FACINGS = ["down", "up", "left", "right"] as const;
export type SeatFacing = (typeof SEAT_FACINGS)[number];

/** `sittable`: a player walking into it sits on it. `facing`: where the person looks while sitting. */
export type ObjectTag = { sittable: true; facing: SeatFacing };

const tags = new Map<string, ObjectTag>(Object.entries(registry as Record<string, ObjectTag>));

export const getObjectTag = (id: string): ObjectTag | undefined => tags.get(id);

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
  if (tag) tags.set(id, tag);
  else tags.delete(id);
  return true;
}
