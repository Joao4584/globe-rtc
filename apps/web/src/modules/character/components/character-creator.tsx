"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, Dices, Loader2 } from "lucide-react";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import { useUser } from "@/modules/profile/hooks/use-user";
import {
  getSkinCatalog,
  renderSkin,
  rollSkin,
  saveSkin,
  type RenderedSkin,
  type SkinCatalog,
  type SkinPart,
  type SkinSelection,
  type SkinStyleGroup,
  type SkinType,
} from "../services/character";
import { SkinPreview } from "./skin-preview";

const PARTS: SkinPart[] = ["body", "eyes", "hairstyle", "outfit", "accessory"];
const OPTIONAL: SkinPart[] = ["hairstyle", "accessory"];
const ANIMATIONS = ["idle", "walk", "sit", "throw", "punch", "hurt"] as const;
const RENDER_DEBOUNCE_MS = 150;

type PartKey = "body" | "eyes" | "hairstyle" | "outfit" | "accessory";

// Builds the lookup of the labels of this page without repeating the long key everywhere.
function useLabels() {
  const t = useI18n();
  return (key: string) => t(`dashboard.character.${key}` as "dashboard.character.title");
}

// ---- selection helpers: a part is a list of styles, each style has colour variants ----

const groupsOf = (catalog: SkinCatalog, type: SkinType, part: SkinPart): SkinStyleGroup[] => catalog[type][part] ?? [];
const groupIndexOf = (groups: SkinStyleGroup[], id: string | null) => (id === null ? -1 : groups.findIndex((group) => group.variants.includes(id)));

function withStyle(selection: SkinSelection, catalog: SkinCatalog, part: SkinPart, delta: number): SkinSelection {
  const groups = groupsOf(catalog, selection.type, part);
  const optional = OPTIONAL.includes(part);
  const current = selection[part as PartKey] as string | null;
  const index = groupIndexOf(groups, current);
  // Optional parts have one extra stop before the first style: "none".
  const stops = groups.length + (optional ? 1 : 0);
  const position = (optional ? index + 1 : index) + delta;
  const next = ((position % stops) + stops) % stops;
  const nextIndex = optional ? next - 1 : next;
  if (nextIndex < 0) return { ...selection, [part]: null };

  const variants = groups[nextIndex].variants;
  const keep = index >= 0 ? Math.max(0, groups[index].variants.indexOf(current as string)) : 0;
  return { ...selection, [part]: variants[Math.min(keep, variants.length - 1)] };
}

function withVariant(selection: SkinSelection, catalog: SkinCatalog, part: SkinPart, delta: number): SkinSelection {
  const groups = groupsOf(catalog, selection.type, part);
  const current = selection[part as PartKey] as string | null;
  const group = groups[groupIndexOf(groups, current)];
  if (!group || current === null) return selection;
  const index = group.variants.indexOf(current);
  const next = (index + delta + group.variants.length) % group.variants.length;
  return { ...selection, [part]: group.variants[next] };
}

// ---- small pieces of the screen ----

// One row: previous arrow, the current value in the middle, next arrow.
function Stepper({ label, value, onPrev, onNext }: { label: string; value: string; onPrev: () => void; onNext: () => void }) {
  const arrow = "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/60 text-foreground transition hover:bg-accent";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onPrev} className={arrow} aria-label={`${label} -`}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-center text-xs tabular-nums text-muted-foreground">{value}</span>
      <button type="button" onClick={onNext} className={arrow} aria-label={`${label} +`}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border border-border bg-card/60 p-5", className)}>{children}</section>;
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-md px-3 py-2 text-sm font-medium transition", active ? "bg-primary text-primary-foreground" : "bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground")}
    >
      {children}
    </button>
  );
}

export function CharacterCreator() {
  const label = useLabels();
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  const [catalog, setCatalog] = useState<SkinCatalog | null>(null);
  const [selection, setSelection] = useState<SkinSelection | null>(null);
  const [rendered, setRendered] = useState<RenderedSkin | null>(null);
  const [animation, setAnimation] = useState<string>("idle");
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const isFirstCharacter = user ? !user.skin : false;
  const renderId = useRef(0);

  // The pieces to pick from, then the user's own character, or a random one when they have none yet.
  useEffect(() => {
    getSkinCatalog().then(setCatalog).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!user || selection) return;
    const saved = user.skin as unknown as SkinSelection | null | undefined;
    if (saved) setSelection(saved);
    else rollSkin("adult").then(setSelection).catch(() => setFailed(true));
  }, [user, selection]);

  // Re-render the preview a moment after the last click (every click is a request to the API).
  useEffect(() => {
    if (!selection) return;
    const id = ++renderId.current;
    const timer = window.setTimeout(() => {
      renderSkin(selection)
        .then((skin) => id === renderId.current && setRendered(skin))
        .catch(() => id === renderId.current && setFailed(true));
    }, RENDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [selection]);

  const change = useCallback((next: SkinSelection) => {
    setSelection(next);
    setSaved(false);
    setSaveError(false);
  }, []);

  const randomize = async () => {
    if (!selection) return;
    try {
      change(await rollSkin(selection.type));
    } catch {
      setFailed(true);
    }
  };

  const switchType = async (type: SkinType) => {
    if (!selection || selection.type === type) return;
    try {
      change(await rollSkin(type));
    } catch {
      setFailed(true);
    }
  };

  const finish = async () => {
    if (!selection || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveSkin(selection);
      queryClient.setQueryData(["user"], (previous: object | undefined) => (previous ? { ...previous, skin: selection } : previous));
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    if (!catalog || !selection) return [];
    return PARTS.filter((part) => groupsOf(catalog, selection.type, part).length > 0);
  }, [catalog, selection]);

  if (failed) return <p className="p-8 text-sm text-rose-300">{label("loadFailed")}</p>;
  if (!catalog || !selection) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-[320px_1fr_220px]">
      {/* pick the pieces */}
      <Panel className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {(["adult", "kid"] as const).map((type) => (
            <Choice key={type} active={selection.type === type} onClick={() => void switchType(type)}>
              {label(type)}
            </Choice>
          ))}
        </div>

        {rows.map((part) => {
          const groups = groupsOf(catalog, selection.type, part);
          const optional = OPTIONAL.includes(part);
          const current = selection[part as PartKey] as string | null;
          const index = groupIndexOf(groups, current);
          const group = groups[index];
          const partName = label(part);
          const hasStyles = groups.length > 1 || optional;
          const hasColors = !!group && group.variants.length > 1;
          if (!hasStyles && !hasColors) return null;
          return (
            <div key={part} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{partName}</p>
              {hasStyles ? (
                <Stepper
                  label={partName}
                  value={current === null ? label("none") : `${index + 1} / ${groups.length}`}
                  onPrev={() => change(withStyle(selection, catalog, part, -1))}
                  onNext={() => change(withStyle(selection, catalog, part, 1))}
                />
              ) : null}
              {hasColors ? (
                <Stepper
                  label={`${partName} ${label("color")}`}
                  value={`${label("color")} ${group.variants.indexOf(current as string) + 1} / ${group.variants.length}`}
                  onPrev={() => change(withVariant(selection, catalog, part, -1))}
                  onNext={() => change(withVariant(selection, catalog, part, 1))}
                />
              ) : null}
            </div>
          );
        })}
      </Panel>

      {/* the character */}
      <Panel className="flex min-h-[420px] items-center justify-center">
        {rendered ? (
          <SkinPreview sheet={rendered.spritesheet} layout={rendered.layout} animation={animation} direction="down" scale={5} />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </Panel>

      {/* which animation to see, random, and finish */}
      <Panel className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{label("animation")}</p>
          <div className="grid gap-1.5">
            {ANIMATIONS.map((name) => (
              <Choice key={name} active={animation === name} onClick={() => setAnimation(name)}>
                {label(`anim_${name}`)}
              </Choice>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-2">
          {saveError ? <p className="text-xs text-rose-400">{label("saveFailed")}</p> : null}
          <button
            type="button"
            onClick={() => void randomize()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <Dices className="h-4 w-4" />
            {label("random")}
          </button>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saving ? label("saving") : saved ? label("saved") : label(isFirstCharacter ? "createButton" : "save")}
          </button>
        </div>
      </Panel>
    </div>
  );
}
