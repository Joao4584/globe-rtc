"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, Dices, Loader2, RotateCcw, RotateCw } from "lucide-react";
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

function Stepper({ label, value, onPrev, onNext }: { label: string; value: string; onPrev: () => void; onNext: () => void }) {
  const arrow = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-accent";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onPrev} className={arrow} aria-label={`${label} -`}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex h-9 min-w-0 flex-1 -skew-x-12 items-center justify-between border border-border bg-card px-4 text-foreground">
        <span className="skew-x-12 truncate text-sm font-semibold uppercase tracking-wide">{label}</span>
        <span className="skew-x-12 text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
      <button type="button" onClick={onNext} className={arrow} aria-label={`${label} +`}>
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
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
  const [direction, setDirection] = useState("down");
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

  const animationInfo = rendered?.layout.animations.find((item) => item.name === animation);
  const rotate = (delta: number) => {
    if (!animationInfo) return;
    const list = animationInfo.directions;
    const index = Math.max(0, list.indexOf(direction));
    setDirection(list[(index + delta + list.length) % list.length]);
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
    <div className="relative min-h-[calc(100dvh-69px)] overflow-hidden text-foreground">
      <div className="relative mx-auto flex min-h-[calc(100dvh-69px)] max-w-6xl flex-col gap-6 p-6 lg:flex-row">
        {/* left: pick the pieces */}
        <div className="w-full shrink-0 space-y-3 lg:w-[340px]">
          <div className="-skew-x-12 border border-primary/40 bg-primary/15 px-6 py-2 text-foreground">
            <h1 className="skew-x-12 text-lg font-bold">{label(isFirstCharacter ? "titleCreate" : "title")}</h1>
          </div>

          <div className="flex gap-2 pt-1">
            {(["adult", "kid"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void switchType(type)}
                className={cn("-skew-x-12 border px-4 py-1.5 text-sm font-semibold transition", selection.type === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}
              >
                <span className="inline-block skew-x-12">{label(type)}</span>
              </button>
            ))}
          </div>

          {rows.map((part) => {
            const groups = groupsOf(catalog, selection.type, part);
            const optional = OPTIONAL.includes(part);
            const current = selection[part as PartKey] as string | null;
            const index = groupIndexOf(groups, current);
            const group = groups[index];
            const partName = label(part);
            return (
              <div key={part} className="space-y-3">
                {groups.length > 1 || optional ? (
                  <Stepper
                    label={partName}
                    value={current === null ? label("none") : `${index + 1}/${groups.length}`}
                    onPrev={() => change(withStyle(selection, catalog, part, -1))}
                    onNext={() => change(withStyle(selection, catalog, part, 1))}
                  />
                ) : null}
                {group && group.variants.length > 1 ? (
                  <Stepper
                    label={groups.length > 1 || optional ? `${partName} · ${label("color")}` : partName}
                    value={`${group.variants.indexOf(current as string) + 1}/${group.variants.length}`}
                    onPrev={() => change(withVariant(selection, catalog, part, -1))}
                    onNext={() => change(withVariant(selection, catalog, part, 1))}
                  />
                ) : null}
              </div>
            );
          })}

          <div className="-skew-x-12 border border-border bg-card px-5 py-2 text-muted-foreground">
            <p className="skew-x-12 text-sm font-semibold">
              {label("name")}: <span className="text-foreground">{user?.name ?? ""}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void randomize()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            <Dices className="h-4 w-4" />
            {label("random")}
          </button>
        </div>

        {/* centre: the character */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
          <div className="relative flex h-[340px] items-end justify-center">
            {rendered ? (
              <SkinPreview sheet={rendered.spritesheet} layout={rendered.layout} animation={animation} direction={direction} scale={5} />
            ) : (
              <Loader2 className="mb-32 h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="h-10 w-56 rounded-md border border-border bg-card/60" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => rotate(-1)} className="rounded-full border border-border bg-card p-2 text-foreground hover:bg-accent" aria-label={label("rotateLeft")}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => rotate(1)} className="rounded-full border border-border bg-card p-2 text-foreground hover:bg-accent" aria-label={label("rotateRight")}>
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* right: which animation to see, and finish */}
        <div className="flex w-full shrink-0 flex-col justify-between gap-6 lg:w-56">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label("animation")}</p>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {ANIMATIONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setAnimation(name)}
                  className={cn("-skew-x-12 border px-4 py-1.5 text-left text-sm font-semibold transition", animation === name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}
                >
                  <span className="inline-block skew-x-12">{label(`anim_${name}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {saveError ? <p className="text-xs text-rose-300">{label("saveFailed")}</p> : null}
            <button
              type="button"
              onClick={() => void finish()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary bg-primary px-6 py-3 text-lg font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <Check className="h-5 w-5 text-emerald-300" /> : null}
              {saving ? label("saving") : saved ? label("saved") : label(isFirstCharacter ? "createButton" : "save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
