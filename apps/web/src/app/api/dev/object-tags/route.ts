import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

// Development only: lets the map editor write the flags of an asset (sittable...) into the committed registry file.
const FILE = path.join(process.cwd(), "public", "object-tags.json");
const ID = /^[A-Za-z0-9_]{1,120}$/;
const FACINGS = new Set(["down", "up", "left", "right"]);

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "disabled" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { id?: unknown; tag?: unknown } | null;
  if (!body || typeof body.id !== "string" || !ID.test(body.id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const tag = body.tag as { sittable?: unknown; facing?: unknown } | null;
  if (tag !== null && (typeof tag !== "object" || tag.sittable !== true || typeof tag.facing !== "string" || !FACINGS.has(tag.facing))) {
    return NextResponse.json({ error: "bad tag" }, { status: 400 });
  }

  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(await fs.readFile(FILE, "utf8")) as Record<string, unknown>;
  } catch {
    current = {};
  }
  if (tag) current[body.id] = { sittable: true, facing: tag.facing };
  else delete current[body.id];

  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(FILE, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  return NextResponse.json({ ok: true });
}
