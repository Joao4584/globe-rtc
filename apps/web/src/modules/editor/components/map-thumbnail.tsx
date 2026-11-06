"use client";

import React, { useEffect, useRef } from "react";
import { TILE, getItem, type ItemKind, type MapItem } from "../assets/map-assets";
import { parseMap } from "../assets/map-data";

const MAX_SIDE = 4096;

type Drawable = { item: MapItem; px: number; py: number; order: number };

// Draws a saved map (any layer mode, collision hidden) with the same pieces the editor and the game use.
export function MapThumbnail({ data }: { data: unknown }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = React.useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parsed = parseMap(data);
    const records = parsed?.layers ? parsed.records.filter((rec) => rec.kind !== "collision") : [];
    if (!canvas || !parsed?.layers || records.length === 0) {
      setEmpty(true);
      return;
    }
    setEmpty(false);

    let cancelled = false;
    const layerIndex = new Map(parsed.layers.map((layer, index) => [layer.id, index]));
    const hidden = new Set(parsed.layers.filter((layer) => !layer.visible).map((layer) => layer.id));
    const modes = new Map(parsed.layers.map((layer) => [layer.id, layer.mode]));

    Promise.all(
      records
        .filter((rec) => !hidden.has(rec.layer))
        .map((rec, seq) =>
          getItem(rec.kind as ItemKind, rec.id)
            .then((item): Drawable => {
              const px = rec.x * TILE + item.offsetX;
              const py = rec.y * TILE + item.offsetY;
              const base = (layerIndex.get(rec.layer) ?? 0) * 2_000_000 + 500_000;
              return { item, px, py, order: rec.flat ? base - 400_000 + seq : base + (modes.get(rec.layer) === "ysort" ? py + item.height : seq) };
            })
            .catch(() => null),
        ),
    ).then((all) => {
      if (cancelled) return;
      const drawables = all.filter((entry): entry is Drawable => entry !== null).sort((a, b) => a.order - b.order);
      if (!drawables.length) return setEmpty(true);

      const minX = Math.min(...drawables.map((d) => d.px));
      const minY = Math.min(...drawables.map((d) => d.py));
      const maxX = Math.max(...drawables.map((d) => d.px + d.item.width));
      const maxY = Math.max(...drawables.map((d) => d.py + d.item.height));
      const scale = Math.min(1, MAX_SIDE / Math.max(maxX - minX, maxY - minY));
      canvas.width = Math.max(1, Math.round((maxX - minX) * scale));
      canvas.height = Math.max(1, Math.round((maxY - minY) * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      for (const d of drawables) {
        ctx.drawImage(d.item.canvas, Math.round((d.px - minX) * scale), Math.round((d.py - minY) * scale), Math.round(d.item.width * scale), Math.round(d.item.height * scale));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div
      className="flex h-[150px] w-full items-center justify-center bg-black"
      style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      <canvas ref={canvasRef} className={empty ? "hidden" : "max-h-full max-w-full object-contain"} style={{ imageRendering: "pixelated" }} />
    </div>
  );
}
