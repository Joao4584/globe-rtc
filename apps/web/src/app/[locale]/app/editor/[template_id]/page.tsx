"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Redo2, Save, Undo2 } from "lucide-react";
import { useI18n } from "@/locales/client";
import { MAP_TEMPLATES_KEY, useMapTemplate } from "@/modules/editor/hooks/use-map-templates";
import { saveMapTemplate } from "@/modules/editor/services/map-templates";
import { MapPalette } from "@/modules/editor/components/map-palette";
import { LayersPanel } from "@/modules/editor/components/layers-panel";
import { defaultLayers, type LayerState } from "@/modules/editor/assets/map-layers";
import { ui } from "@/modules/editor/ui/theme";
import type { Brush } from "@/modules/editor/assets/map-assets";
import type { BuilderController, CursorTile, HistoryState } from "@/modules/editor/scenes/builder-scene";

const BuilderGame = dynamic(() => import("@/modules/editor/builder-game").then((mod) => mod.BuilderGame), { ssr: false });

// The app header (69px) stays on top of this full-screen page, so the overlay texts start below it.
const BELOW_HEADER = "top-[84px]";

export default function Page() {
  const t = useI18n();
  const params = useParams<{ template_id?: string | string[] }>();
  const templateId = Array.isArray(params.template_id) ? params.template_id[0] : params.template_id;
  const { data, isLoading, isError } = useMapTemplate(templateId ?? null);
  const [cursor, setCursor] = useState<CursorTile>(null);
  const [brush, setBrush] = useState<Brush | null>(null);
  const [layerState, setLayerState] = useState<LayerState | null>(null);
  const [controller, setController] = useState<BuilderController | null>(null);
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<HistoryState>({ canUndo: false, canRedo: false });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const queryClient = useQueryClient();

  const initialLayers = useMemo(
    () =>
      defaultLayers({
        floor: t("dashboard.editor.builder.layers.defaultFloor"),
        wall: t("dashboard.editor.builder.layers.defaultWall"),
        wallTop: t("dashboard.editor.builder.layers.defaultWallTop"),
        objects: t("dashboard.editor.builder.layers.defaultObjects"),
        collision: t("dashboard.editor.builder.layers.defaultCollision"),
      }),
    [t],
  );

  const save = useCallback(async () => {
    if (!controller || !templateId || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const saved = await saveMapTemplate(templateId, controller.serialize());
      controller.markSaved();
      queryClient.setQueryData(["map-templates:detail", templateId], saved);
      void queryClient.invalidateQueries({ queryKey: [MAP_TEMPLATES_KEY] });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [controller, templateId, saving, queryClient]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save();
        return;
      }
      // Leave Ctrl+Z alone while typing in a field (layer rename, search...).
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        controller?.undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        controller?.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, controller]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {isError ? (
        <div className="flex h-full items-center justify-center text-sm text-rose-300">{t("dashboard.editor.builder.loadFailed")}</div>
      ) : isLoading ? null : (
        <BuilderGame
          mapId={templateId ?? ""}
          initialData={data?.data}
          defaultLayers={initialLayers}
          brush={brush}
          onCursorChange={setCursor}
          onBrushClear={() => setBrush(null)}
          onLayersChange={setLayerState}
          onDirtyChange={setDirty}
          onHistoryChange={setHistory}
          onController={setController}
        />
      )}
      {data ? <MapPalette brush={brush} onBrush={setBrush} /> : null}
      {layerState && controller ? <LayersPanel state={layerState} controller={controller} /> : null}

      <div className={`pointer-events-none absolute left-3 ${BELOW_HEADER} flex items-center gap-3`}>
        <Link
          href="/app/editor"
          onClick={(event) => {
            if (dirty && !window.confirm(t("dashboard.editor.builder.unsavedConfirm"))) event.preventDefault();
          }}
          className={`pointer-events-auto inline-flex items-center gap-2 px-3 py-2 text-sm ${ui.panel} ${ui.ghost}`}>
          <ArrowLeft className="h-4 w-4" />
          {t("dashboard.editor.builder.back")}
        </Link>
        {data ? <span className={`px-3 py-2 text-sm font-semibold ${ui.panel}`}>{data.name}</span> : null}
        {data && controller ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || (!dirty && !saveError)}
            className={`pointer-events-auto inline-flex items-center gap-2 px-3 py-2 text-sm ${dirty || saveError ? ui.button : `${ui.panel} ${ui.ghost}`}`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty || saveError ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {saving ? t("dashboard.editor.builder.saving") : dirty || saveError ? t("dashboard.editor.builder.save") : t("dashboard.editor.builder.saved")}
          </button>
        ) : null}
        {data && controller ? (
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => controller.undo()}
              disabled={!history.canUndo}
              title={t("dashboard.editor.builder.undo") + " (Ctrl+Z)"}
              aria-label={t("dashboard.editor.builder.undo")}
              className={`inline-flex items-center px-2 py-2 text-sm disabled:opacity-40 ${ui.panel} ${ui.ghost}`}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => controller.redo()}
              disabled={!history.canRedo}
              title={t("dashboard.editor.builder.redo") + " (Ctrl+Shift+Z)"}
              aria-label={t("dashboard.editor.builder.redo")}
              className={`inline-flex items-center px-2 py-2 text-sm disabled:opacity-40 ${ui.panel} ${ui.ghost}`}
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {saveError ? <span className="text-xs text-rose-300">{t("dashboard.editor.builder.saveFailed")}</span> : null}
      </div>

      <p className={`pointer-events-none absolute right-3 ${BELOW_HEADER} max-w-[45vw] text-right text-xs text-slate-400`}>{t("dashboard.editor.builder.hint")}</p>
      {cursor ? (
        <div className={`pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 ${ui.panel}`}>
          <span className={ui.label}>{t("dashboard.editor.builder.cursorLabel")}</span>
          <span className="text-sm font-semibold tabular-nums">
            {cursor.x}, {cursor.y}
          </span>
        </div>
      ) : null}
    </div>
  );
}
