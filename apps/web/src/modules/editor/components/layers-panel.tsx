"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Info, Lock, Plus, Square, Trash2, Unlock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/shared/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/modules/shared/ui/tooltip";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import { isProtectedLayer, layerAccepts, type LayerController, type LayerState, type MapLayer } from "../assets/map-layers";
import type { ObjectRule } from "../assets/object-rules";
import type { SelectedObject } from "../scenes/builder-scene";
import { ObjectRuleCard } from "./object-rule-card";
import { ui } from "../ui/theme";

type LayersPanelProps = {
  state: LayerState;
  controller: LayerController;
  /** Object picked with the empty hand (shown in the card under the layers). */
  selection?: SelectedObject | null;
  /** Sets (or clears) the rule of the selected object. */
  onRuleChange?: (rule: ObjectRule | null) => void;
};

// Draws the picked object in a small square, scaled down to fit and kept pixel-sharp.
function SelectionPreview({ source }: { source: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const size = canvas.width;
    const scale = Math.min(size / source.width, size / source.height, 4);
    const w = Math.max(1, Math.round(source.width * scale));
    const h = Math.max(1, Math.round(source.height * scale));
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
  }, [source]);
  return <canvas ref={ref} width={64} height={64} className="h-16 w-16 shrink-0 rounded border border-yellow-400/70 bg-slate-500/10" />;
}

// Layer stack of the map, highest layer first. Painting and erasing act on the selected (active) layer.
export function LayersPanel({ state, controller, selection = null, onRuleChange }: LayersPanelProps) {
  const t = useI18n();
  const [renaming, setRenaming] = useState<string | null>(null);
  const top = state.layers.length - 1;

  const remove = (layer: MapLayer) => {
    if (window.confirm(t("dashboard.editor.builder.layers.removeConfirm", { name: layer.name }))) controller.removeLayer(layer.id);
  };

  const iconButton = cn("p-1", ui.ghost);

  return (
    <div className={cn("absolute left-3 top-32 z-10 max-h-[calc(100vh-9rem)] w-72 overflow-y-auto shadow-xl", ui.panel)}>
      <div className={cn("flex items-center gap-1 border-b px-2 py-1.5", ui.divider)}>
        <span className={ui.label}>{t("dashboard.editor.builder.layers.title")}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn("p-0.5", ui.ghost)} aria-label={t("dashboard.editor.builder.layers.helpButton")}>
              <Info className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className={cn("z-[80] w-64 p-3 text-xs", ui.panel)}>
            <p className="mb-1.5 text-sm font-semibold">{t("dashboard.editor.builder.layers.helpTitle")}</p>
            <ul className="list-disc space-y-1 pl-4 leading-snug">
              <li>{t("dashboard.editor.builder.layers.helpItem1")}</li>
              <li>{t("dashboard.editor.builder.layers.helpItem2")}</li>
              <li>{t("dashboard.editor.builder.layers.helpItem3")}</li>
              <li>{t("dashboard.editor.builder.layers.helpItem4")}</li>
              <li>{t("dashboard.editor.builder.layers.helpItem5")}</li>
              <li>{t("dashboard.editor.builder.layers.helpItem6")}</li>
            </ul>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          className={cn("ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs", ui.ghost)}
          onClick={() => controller.addLayer("art", t("dashboard.editor.builder.layers.newName", { number: state.layers.length + 1 }))}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("dashboard.editor.builder.layers.add")}
        </button>
        <button
          type="button"
          className={cn("inline-flex items-center gap-1 px-2 py-1 text-xs", ui.ghost)}
          onClick={() => controller.addLayer("collision", t("dashboard.editor.builder.layers.newCollisionName"))}
        >
          <Plus className="h-3.5 w-3.5 text-red-400" />
          {t("dashboard.editor.builder.layers.addCollision")}
        </button>
      </div>

      <ul className="max-h-[45vh] overflow-y-auto py-1">
        {[...state.layers].reverse().map((layer) => {
          const index = state.layers.indexOf(layer);
          const active = layer.id === state.activeId;
          return (
            <li key={layer.id} className={cn("border-l-2 px-1.5 py-1", active ? ui.rowActive : ui.rowIdle)}>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className={iconButton}
                  title={layer.visible ? t("dashboard.editor.builder.layers.hide") : t("dashboard.editor.builder.layers.show")}
                  onClick={() => controller.updateLayer(layer.id, { visible: !layer.visible })}
                >
                  {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className={iconButton}
                  title={layer.locked ? t("dashboard.editor.builder.layers.unlock") : t("dashboard.editor.builder.layers.lock")}
                  onClick={() => controller.updateLayer(layer.id, { locked: !layer.locked })}
                >
                  {layer.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
                {layer.type === "collision" ? <Square className="h-3.5 w-3.5 shrink-0 fill-red-500/60 text-red-400" /> : null}

                {renaming === layer.id ? (
                  <input
                    autoFocus
                    defaultValue={layer.name}
                    maxLength={40}
                    className={cn("mx-1 h-7 min-w-0 flex-1 px-2", ui.field)}
                    onBlur={(event) => {
                      controller.renameLayer(layer.id, event.target.value);
                      setRenaming(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn("mx-1 min-w-0 flex-1 truncate text-left text-sm", !layer.visible && "text-slate-400 line-through dark:text-slate-500")}
                        onClick={() => controller.setActiveLayer(layer.id)}
                        onDoubleClick={() => setRenaming(layer.id)}
                      >
                        {layer.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8} className="z-[80]">
                      {layer.type === "art"
                        ? t(`dashboard.editor.builder.layers.accepts.${layerAccepts(layer)}` as "dashboard.editor.builder.layers.accepts.floor")
                        : t("dashboard.editor.builder.layers.collisionInfo")}
                    </TooltipContent>
                  </Tooltip>
                )}

                <button type="button" className={iconButton} disabled={index === top} title={t("dashboard.editor.builder.layers.up")} onClick={() => controller.moveLayer(layer.id, 1)}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className={iconButton} disabled={index === 0} title={t("dashboard.editor.builder.layers.down")} onClick={() => controller.moveLayer(layer.id, -1)}>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {isProtectedLayer(layer) ? (
                  <Lock className="mx-1 h-3.5 w-3.5 opacity-40" aria-label={t("dashboard.editor.builder.layers.protected")} />
                ) : (
                  <button type="button" className={iconButton} disabled={state.layers.length <= 1} title={t("dashboard.editor.builder.layers.remove")} onClick={() => remove(layer)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className={cn("border-t px-2 py-1.5", ui.divider)}>
        <span className={ui.label}>{t("dashboard.editor.builder.layers.selected")}</span>
        {selection ? (
          <div className="mt-1 flex items-center gap-2">
            <SelectionPreview source={selection.preview} />
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold" title={selection.id}>
                {selection.id}
              </p>
              <p className={ui.muted}>
                {selection.kind}
                {selection.animated ? " · anim" : ""}
              </p>
              <p className={ui.muted}>{t("dashboard.editor.builder.layers.selectedPosition", { x: selection.x, y: selection.y })}</p>
            </div>
          </div>
        ) : (
          <p className={cn("mt-1 text-xs", ui.muted)}>{t("dashboard.editor.builder.layers.selectedNone")}</p>
        )}
      </div>
      {selection && onRuleChange ? <ObjectRuleCard key={selection.key} selection={selection} onChange={onRuleChange} /> : null}
    </div>
  );
}
