"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Palette, X } from "lucide-react";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import {
  SHEETS,
  TILE,
  brushFromObject,
  brushFromSheetRect,
  loadObjectTheme,
  loadObjectThemes,
  objectPageUrl,
  type Brush,
  type ObjectThemeInfo,
  type ObjectThemeManifest,
  type SheetKind,
} from "../assets/map-assets";
import { ui } from "../ui/theme";

type Tab = "objects" | SheetKind;
const TABS: { id: Tab; label: "tabObjects" | "tabWalls" | "tabFloors" | "tabBorders" }[] = [
  { id: "objects", label: "tabObjects" },
  { id: "wall", label: "tabWalls" },
  { id: "floor", label: "tabFloors" },
  { id: "border", label: "tabBorders" },
];
type Rect = { x0: number; y0: number; x1: number; y1: number };

type MapPaletteProps = {
  brush: Brush | null;
  onBrush: (brush: Brush | null) => void;
};


// Menu in the bottom-right corner. Objects: pick a category (atlas theme) and click one. Walls, floors and borders show
// the whole Room Builder sheet: drag a rectangle and that block of tiles sticks to the mouse in the map.
export function MapPalette({ brush, onBrush }: MapPaletteProps) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("objects");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (next: Brush) => {
    onBrush(next);
    setOpen(false);
  };

  return (
    <>
      {open ? (
        <div className={cn("absolute bottom-20 right-3 z-10 flex h-[70vh] w-[620px] max-w-[calc(100vw-1.5rem)] flex-col shadow-2xl", ui.panel)}>
          <div className={cn("flex items-center gap-2 border-b p-2", ui.divider)}>
            {TABS.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn("px-3 py-1 text-sm font-medium", tab === id ? ui.tabOn : ui.tabOff)}>
                {t(`dashboard.editor.builder.palette.${label}`)}
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className={cn("ml-auto p-1", ui.ghost)} aria-label="close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {tab === "objects" ? <ObjectsTab onPick={pick} /> : <SheetTab key={tab} kind={tab} onPick={pick} />}
        </div>
      ) : null}

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        {brush ? (
          <button type="button" onClick={() => onBrush(null)} className={cn("px-3 py-2 text-sm", ui.panel, ui.ghost)}>
            {t("dashboard.editor.builder.palette.drop")}
          </button>
        ) : null}
        <button type="button" onClick={() => setOpen((value) => !value)} className={cn("inline-flex items-center gap-2 px-3 py-2 text-sm", ui.panel, ui.ghost)}>
          <Palette className="h-4 w-4" />
          {t("dashboard.editor.builder.palette.open")}
        </button>
      </div>
    </>
  );
}

const THUMB = 84;

// Objects are picked one by one: choose a category (theme), optionally filter by number or name, click the picture.
function ObjectsTab({ onPick }: { onPick: (brush: Brush) => void }) {
  const t = useI18n();
  const [themes, setThemes] = useState<ObjectThemeInfo[] | null>(null);
  const [theme, setTheme] = useState("");
  const [manifest, setManifest] = useState<ObjectThemeManifest | null>(null);
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadObjectThemes()
      .then((list) => {
        setThemes(list);
        setTheme((current) => current || list[0]?.name || "");
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!theme) return;
    setManifest(null);
    loadObjectTheme(theme).then(setManifest).catch(() => setFailed(true));
  }, [theme]);

  const visible = useMemo(() => {
    if (!manifest) return [];
    const words = query.trim().toLowerCase().split(/s+/).filter(Boolean);
    return manifest.objects.filter((object) => words.every((word) => object.id.toLowerCase().includes(word) || String(object.n) === word));
  }, [manifest, query]);

  if (failed) return <p className="p-4 text-sm text-rose-500 dark:text-rose-300">{t("dashboard.editor.builder.palette.loadFailed")}</p>;
  if (!themes) return <p className={cn("p-4 text-sm", ui.muted)}>{t("dashboard.editor.builder.palette.loading")}</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <select aria-label={t("dashboard.editor.builder.palette.theme")} value={theme} onChange={(event) => setTheme(event.target.value)} className={cn("h-8 px-2", ui.field)}>
          {themes.map((info) => (
            <option key={info.name} value={info.name}>
              {info.label} ({info.count})
            </option>
          ))}
        </select>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("dashboard.editor.builder.palette.search")} className={cn("h-8 min-w-0 flex-1 px-2", ui.field)} />
        <p className={cn("w-full text-xs", ui.muted)}>{t("dashboard.editor.builder.palette.objectsHint")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 pt-0">
        {!manifest ? (
          <p className={cn("text-sm", ui.muted)}>{t("dashboard.editor.builder.palette.loading")}</p>
        ) : visible.length === 0 ? (
          <p className={cn("text-sm", ui.muted)}>{t("dashboard.editor.builder.palette.noResults")}</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {visible.map((object) => {
              const page = manifest.pages[object.page];
              const scale = Math.min(1, (THUMB - 8) / Math.max(object.w, object.h));
              return (
                <button
                  key={object.id}
                  type="button"
                  title={object.id}
                  onClick={() => void brushFromObject(object.id).then(onPick)}
                  className="flex shrink-0 items-center justify-center bg-[#2a2a2a] hover:bg-sky-400/30"
                  style={{ width: THUMB, height: THUMB }}
                >
                  <div
                    style={{
                      width: object.w * scale,
                      height: object.h * scale,
                      backgroundImage: `url(${objectPageUrl(page.file)})`,
                      backgroundSize: `${page.width * scale}px ${page.height * scale}px`,
                      backgroundPosition: `-${object.x * scale}px -${object.y * scale}px`,
                      imageRendering: "pixelated",
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SheetTab({ kind, onPick }: { kind: SheetKind; onPick: (brush: Brush) => void }) {
  const t = useI18n();
  const sheet = SHEETS[kind];
  const [drag, setDrag] = useState<Rect | null>(null);

  const cellAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(sheet.cols - 1, Math.max(0, Math.floor((event.clientX - rect.left) / TILE))),
      y: Math.min(sheet.rows - 1, Math.max(0, Math.floor((event.clientY - rect.top) / TILE))),
    };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className={cn("p-2 text-xs", ui.muted)}>{t("dashboard.editor.builder.palette.wallsHint")}</p>
      <div className="min-h-0 flex-1 overflow-auto p-2 pt-0">
        <div
          className="relative cursor-crosshair select-none bg-[#2a2a2a]"
          style={{ width: sheet.cols * TILE, height: sheet.rows * TILE, touchAction: "none", backgroundImage: `url(${sheet.url})`, imageRendering: "pixelated" }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const cell = cellAt(event);
            setDrag({ x0: cell.x, y0: cell.y, x1: cell.x, y1: cell.y });
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            const cell = cellAt(event);
            setDrag({ ...drag, x1: cell.x, y1: cell.y });
          }}
          onPointerUp={() => {
            if (!drag) return;
            const sel = drag;
            setDrag(null);
            void brushFromSheetRect(kind, Math.min(sel.x0, sel.x1), Math.min(sel.y0, sel.y1), Math.max(sel.x0, sel.x1), Math.max(sel.y0, sel.y1)).then((brush) => brush && onPick(brush));
          }}
        >
          {drag ? (
            <div
              className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/25"
              style={{
                left: Math.min(drag.x0, drag.x1) * TILE,
                top: Math.min(drag.y0, drag.y1) * TILE,
                width: (Math.abs(drag.x1 - drag.x0) + 1) * TILE,
                height: (Math.abs(drag.y1 - drag.y0) + 1) * TILE,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
