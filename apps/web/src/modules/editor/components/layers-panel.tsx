"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Footprints, Lock, Plus, Square, Trash2, Unlock } from "lucide-react";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import type { LayerController, LayerMode, LayerState, MapLayer } from "../assets/map-layers";
import { ui } from "../ui/theme";

type LayersPanelProps = {
  state: LayerState;
  controller: LayerController;
};

// Layer stack of the map, highest layer first. Painting and erasing act on the selected (active) layer.
export function LayersPanel({ state, controller }: LayersPanelProps) {
  const t = useI18n();
  const [renaming, setRenaming] = useState<string | null>(null);
  const top = state.layers.length - 1;

  const modeLabel: Record<LayerMode, string> = {
    below: t("dashboard.editor.builder.layers.modeBelow"),
    ysort: t("dashboard.editor.builder.layers.modeYSort"),
    above: t("dashboard.editor.builder.layers.modeAbove"),
  };

  const remove = (layer: MapLayer) => {
    if (window.confirm(t("dashboard.editor.builder.layers.removeConfirm", { name: layer.name }))) controller.removeLayer(layer.id);
  };

  const iconButton = cn("p-1", ui.ghost);

  return (
    <div className={cn("absolute left-3 top-32 z-10 w-72 shadow-xl", ui.panel)}>
      <div className={cn("flex items-center gap-1 border-b px-2 py-1.5", ui.divider)}>
        <span className={ui.label}>{t("dashboard.editor.builder.layers.title")}</span>
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
                {layer.type === "art" ? (
                  <button
                    type="button"
                    className={cn(iconButton, layer.floor ? "text-emerald-500" : "opacity-40")}
                    title={layer.floor ? t("dashboard.editor.builder.layers.floorOn") : t("dashboard.editor.builder.layers.floorOff")}
                    onClick={() => controller.updateLayer(layer.id, { floor: !layer.floor })}
                  >
                    <Footprints className="h-4 w-4" />
                  </button>
                ) : null}
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
                  <button
                    type="button"
                    className={cn("mx-1 min-w-0 flex-1 truncate text-left text-sm", !layer.visible && "text-slate-400 line-through dark:text-slate-500")}
                    title={t("dashboard.editor.builder.layers.renameHint")}
                    onClick={() => controller.setActiveLayer(layer.id)}
                    onDoubleClick={() => setRenaming(layer.id)}
                  >
                    {layer.name}
                  </button>
                )}

                <button type="button" className={iconButton} disabled={index === top} title={t("dashboard.editor.builder.layers.up")} onClick={() => controller.moveLayer(layer.id, 1)}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className={iconButton} disabled={index === 0} title={t("dashboard.editor.builder.layers.down")} onClick={() => controller.moveLayer(layer.id, -1)}>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button type="button" className={iconButton} disabled={state.layers.length <= 1} title={t("dashboard.editor.builder.layers.remove")} onClick={() => remove(layer)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {layer.type === "art" ? (
                <select
                  value={layer.mode}
                  onChange={(event) => controller.updateLayer(layer.id, { mode: event.target.value as LayerMode })}
                  className={cn("ml-1 mt-1 h-6 w-[calc(100%-0.25rem)] px-1 !text-xs", ui.field)}
                >
                  {(Object.keys(modeLabel) as LayerMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {modeLabel[mode]}
                    </option>
                  ))}
                </select>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className={cn("border-t px-2 py-1.5 text-[11px] leading-snug", ui.divider, ui.muted)}>{t("dashboard.editor.builder.layers.help")}</p>
    </div>
  );
}
