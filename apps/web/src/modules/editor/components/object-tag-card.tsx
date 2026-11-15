"use client";

import React, { useState } from "react";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import { SEAT_FACINGS, getObjectTag, setObjectTag, type SeatFacing } from "../assets/object-tags";
import type { SelectedObject } from "../scenes/builder-scene";
import { ui } from "../ui/theme";

type TagKey = `dashboard.editor.builder.tags.${string}`;

// Flags of the selected asset. "Can sit" makes players sit on every copy of this object (a chair) when they walk into
// it; the direction is where the person looks while sitting. Saved in the asset registry, not in the map.
export function ObjectTagCard({ selection }: { selection: SelectedObject }) {
  const t = useI18n();
  const [tag, setTag] = useState(() => getObjectTag(selection.id));
  const [failed, setFailed] = useState(false);
  if (selection.kind !== "object" && selection.kind !== "animated") return null;

  const label = (key: string) => t(`dashboard.editor.builder.tags.${key}` as TagKey as "dashboard.editor.builder.tags.title");
  const save = async (next: { sittable: true; facing: SeatFacing } | null) => {
    const ok = await setObjectTag(selection.id, next);
    setFailed(!ok);
    if (ok) setTag(next ?? undefined);
  };

  return (
    <div className={cn("border-t px-2 py-1.5", ui.divider)}>
      <span className={ui.label}>{label("title")}</span>
      <label className="mt-1 flex items-center gap-1.5 text-[11px]">
        <input type="checkbox" checked={Boolean(tag?.sittable)} onChange={(event) => void save(event.target.checked ? { sittable: true, facing: tag?.facing ?? "down" } : null)} />
        <span>{label("sittable")}</span>
      </label>
      {tag?.sittable ? (
        <label className="mt-1 block text-[11px]">
          <span className={ui.muted}>{label("facing")}</span>
          <select className={cn("mt-0.5 h-7 w-full px-1.5 text-xs", ui.field)} value={tag.facing} onChange={(event) => void save({ sittable: true, facing: event.target.value as SeatFacing })}>
            {SEAT_FACINGS.map((facing) => (
              <option key={facing} value={facing}>
                {label(`facings.${facing}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className={cn("mt-1.5 text-[11px] leading-snug", failed ? "text-rose-500" : ui.muted)}>{failed ? label("saveFailed") : label("hint")}</p>
    </div>
  );
}
