"use client";

import React from "react";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import { ANIMATION_MODES, ANIMATION_TRIGGERS, DEFAULT_ANIMATION_RULE, type AnimationRule, type ObjectRule } from "../assets/object-rules";
import type { SelectedObject } from "../scenes/builder-scene";
import { ui } from "../ui/theme";

type ObjectRuleCardProps = {
  selection: SelectedObject;
  onChange: (rule: ObjectRule | null) => void;
};

type RuleKey = `dashboard.editor.builder.rules.${string}`;

// Animation effect of the selected animated object: when it plays and what it does. "Always" means no rule (the
// animation just loops, like before rules existed); every other choice is saved with the map and played by the game.
export function ObjectRuleCard({ selection, onChange }: ObjectRuleCardProps) {
  const t = useI18n();
  if (!selection.animated) return null;

  const label = (key: string) => t(`dashboard.editor.builder.rules.${key}` as RuleKey as "dashboard.editor.builder.rules.title");
  const rule: AnimationRule = selection.rule ?? { ...DEFAULT_ANIMATION_RULE, trigger: "always" };
  const update = (patch: Partial<AnimationRule>) => {
    const next = { ...rule, ...patch };
    // "Always" is the same as having no rule.
    onChange(next.trigger === "always" ? null : next);
  };

  const select = cn("mt-0.5 h-7 w-full px-1.5 text-xs", ui.field);

  return (
    <div className={cn("border-t px-2 py-1.5", ui.divider)}>
      <span className={ui.label}>{label("title")}</span>

      <label className="mt-1 block text-[11px]">
        <span className={ui.muted}>{label("trigger")}</span>
        <select className={select} value={rule.trigger} onChange={(event) => update({ trigger: event.target.value as AnimationRule["trigger"], ...(selection.rule ? {} : { mode: DEFAULT_ANIMATION_RULE.mode }) })}>
          {ANIMATION_TRIGGERS.map((trigger) => (
            <option key={trigger} value={trigger}>
              {label(`triggers.${trigger}`)}
            </option>
          ))}
        </select>
      </label>

      {rule.trigger !== "always" ? (
        <>
          <label className="mt-1 block text-[11px]">
            <span className={ui.muted}>{label("mode")}</span>
            <select className={select} value={rule.mode} onChange={(event) => update({ mode: event.target.value as AnimationRule["mode"] })}>
              {ANIMATION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {label(`modes.${mode}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-1 block text-[11px]">
            <span className={ui.muted}>{label("start")}</span>
            <select className={select} value={rule.start} onChange={(event) => update({ start: event.target.value as AnimationRule["start"] })}>
              <option value="first">{label("starts.first")}</option>
              <option value="last">{label("starts.last")}</option>
            </select>
          </label>
        </>
      ) : null}

      <p className={cn("mt-1.5 text-[11px] leading-snug", ui.muted)}>{label(`hints.${rule.trigger}`)}</p>
    </div>
  );
}
