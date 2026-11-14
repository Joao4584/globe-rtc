// Rules attached to a placed object (saved in the map JSON as `rules`, played by the game). See .claude/docs/object-rules.md.
// First rule kind: how an animated object plays its frames.

/** When the animation plays. "always" is the old behaviour: it loops forever. */
export type AnimationTrigger = "always" | "click" | "hover" | "near";

/**
 * What the trigger does:
 * - once: plays forward and stays on the last frame.
 * - once-return: plays forward, then goes back to the resting frame.
 * - toggle: goes to the other end; click again (or leaving, for hover/near) plays it back.
 * - loop: loops (click switches the loop on and off; hover/near loop only while active).
 */
export type AnimationMode = "once" | "once-return" | "toggle" | "loop";

export type AnimationRule = {
  type: "animation";
  trigger: AnimationTrigger;
  /** Ignored when the trigger is "always". */
  mode: AnimationMode;
  /** Frame shown while nothing happened: the first one (default) or the last one. */
  start: "first" | "last";
};

export type ObjectRule = AnimationRule;

export const ANIMATION_TRIGGERS: AnimationTrigger[] = ["always", "click", "hover", "near"];
export const ANIMATION_MODES: AnimationMode[] = ["once", "once-return", "toggle", "loop"];

/** Rule used when the creator starts editing an animated object: still until the player clicks it. */
export const DEFAULT_ANIMATION_RULE: AnimationRule = { type: "animation", trigger: "click", mode: "once", start: "first" };

/** A rule as stored in the map: which placed object it belongs to plus the rule. */
export type MapRule = ObjectRule & { layer: string; ref: string; x: number; y: number };

/** Same placed object (layer + ref like "a:12" + cell) gives the same key in the editor and in the game. */
export const ruleKey = (layer: string, ref: string, x: number, y: number) => `${layer}|${ref}|${x},${y}`;

export function parseRule(raw: unknown): ObjectRule | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rule = raw as Record<string, unknown>;
  if (rule.type !== "animation") return null;
  if (!ANIMATION_TRIGGERS.includes(rule.trigger as AnimationTrigger)) return null;
  return {
    type: "animation",
    trigger: rule.trigger as AnimationTrigger,
    mode: ANIMATION_MODES.includes(rule.mode as AnimationMode) ? (rule.mode as AnimationMode) : "once",
    start: rule.start === "last" ? "last" : "first",
  };
}
