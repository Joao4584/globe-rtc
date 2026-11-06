"use client";

import { useCurrentLocale, useI18n } from "@/locales/client";
import { Skeleton } from "@/modules/shared/ui/skeleton";
import { useInfoUser } from "../hooks/use-info-user";
import { useRoomUiStore } from "../stores/room-ui-store";

function formatMemberSince(dateString: string | undefined, locale: string) {
  if (!dateString) return "---";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "---";

  return new Intl.DateTimeFormat(locale === "pt-br" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getInitials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function PlayerInfoCard() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const publicId = useRoomUiStore((s) => s.selectedPlayerPublicId);
  const { data, isLoading, isError } = useInfoUser(publicId);

  if (!publicId) return null;

  return (
    <aside className="absolute top-4 left-4 z-50 w-[340px] overflow-hidden rounded-2xl border border-sky-200/80 bg-white/92 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-600/60 dark:bg-slate-900/90 dark:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)]">
      <div className="relative h-28 overflow-hidden border-b border-sky-200/80 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.18),transparent_52%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.24),transparent_50%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(226,232,240,0.92))] dark:border-slate-700/60 dark:bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.26),transparent_52%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.26),transparent_50%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))]">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent dark:via-cyan-300/40" />
        <div className="absolute -right-12 top-3 h-24 w-24 rotate-12 rounded-2xl border border-slate-400/20 bg-white/30 dark:border-white/10 dark:bg-white/5" />
        <div className="absolute right-14 top-7 h-10 w-10 rounded-full border border-slate-400/20 bg-white/35 dark:border-white/10 dark:bg-white/5" />
      </div>

      <div className="relative px-4 pb-4">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-lg ring-1 ring-sky-200/80 dark:border-slate-900 dark:bg-slate-800 dark:ring-cyan-200/15">
            {data?.avatar_url ? (
              <img src={data.avatar_url} alt={data.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-slate-700 dark:text-slate-100">{getInitials(data?.name)}</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <section className="mt-4 space-y-3" aria-busy="true" aria-live="polite">
            <Skeleton className="h-5 w-40 rounded-md bg-slate-200 dark:bg-slate-700/70" />
            <Skeleton className="h-4 w-24 rounded-md bg-slate-200 dark:bg-slate-700/60" />
            <Skeleton className="h-14 w-full rounded-xl bg-slate-200 dark:bg-slate-700/50" />
          </section>
        ) : isError || !data ? (
          <div className="mt-4 rounded-xl border border-rose-300/60 bg-rose-50/90 p-3 dark:border-rose-300/20 dark:bg-rose-400/5">
            <p className="text-sm text-rose-700 dark:text-rose-300">{t("room.playerInfo.loadError")}</p>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{data.name}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("room.playerInfo.profileInfo")}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/45">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{t("room.playerInfo.memberSince")}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMemberSince(data.member_since, locale)}</p>
            </div>

            <p className="mt-3 rounded-xl border border-sky-200/80 bg-white/75 px-3 py-2.5 text-xs leading-5 text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/35 dark:text-slate-300">
              {data.description?.trim() || t("room.playerInfo.noDescription")}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
