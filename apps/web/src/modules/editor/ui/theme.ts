// Classes shared by the editor overlays, copied from the in-game cards (ping, invisibility, chat in modules/room/components)
// so both screens look alike in light and dark mode.
export const ui = {
  /** Floating card: the ping / chat card look. */
  panel:
    "rounded-lg border border-sky-200/80 bg-white/90 text-slate-900 shadow-lg backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/85 dark:text-slate-100",
  divider: "border-sky-200/70 dark:border-slate-700/60",
  /** Small uppercase caption, like "PING". */
  label: "text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400",
  muted: "text-slate-500 dark:text-slate-400",
  /** Same button as the chat "Enviar". */
  button:
    "rounded border border-sky-300 bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600",
  /** Quiet icon / text button. */
  ghost:
    "rounded text-slate-500 transition hover:bg-sky-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100",
  /** Inputs and selects, like the chat input. */
  field:
    "rounded border border-sky-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300/70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-400/60",
  tabOn: "rounded bg-sky-600 text-white dark:bg-slate-700 dark:text-slate-100",
  tabOff: "rounded text-slate-600 hover:bg-sky-100 dark:text-slate-400 dark:hover:bg-slate-800",
  rowActive: "border-sky-500 bg-sky-100/80 dark:border-sky-400 dark:bg-slate-700/60",
  rowIdle: "border-transparent hover:bg-sky-50 dark:hover:bg-slate-800/60",
} as const;
