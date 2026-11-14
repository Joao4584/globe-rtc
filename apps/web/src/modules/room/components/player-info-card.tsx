"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useListFriends } from "@/modules/friends/hooks/use-friends";
import { acceptFriendRequest } from "@/modules/friends/services/accept-friend-request";
import { sendFriendRequest } from "@/modules/friends/services/send-friend-request";
import { useUser } from "@/modules/profile/hooks/use-user";
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

// Small profile card of a player: avatar, name, "member since", description and the friend action.
export function PlayerInfoCard() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const queryClient = useQueryClient();
  const publicId = useRoomUiStore((s) => s.selectedPlayerPublicId);
  const closeCard = useRoomUiStore((s) => s.closePlayerInfoCard);
  const { data, isLoading, isError } = useInfoUser(publicId);
  const { data: me } = useUser();
  const { data: friendsData } = useListFriends();

  const refreshFriends = () => queryClient.invalidateQueries({ queryKey: ["friends:list"] });
  const addMutation = useMutation({
    mutationFn: (friendPublicId: string) => sendFriendRequest(friendPublicId),
    onSuccess: () => {
      toast(t("room.playerInfo.requestSent"));
      void refreshFriends();
    },
    onError: () => toast(t("room.playerInfo.requestError")),
  });
  const acceptMutation = useMutation({
    mutationFn: (relationshipId: string) => acceptFriendRequest(relationshipId),
    onSuccess: () => void refreshFriends(),
    onError: () => toast(t("room.playerInfo.requestError")),
  });

  if (!publicId) return null;

  const isSelf = Boolean(me && data && me.public_id === data.public_id);
  const relation = data ? [...(friendsData?.friends ?? []), ...(friendsData?.recent_requests ?? [])].find((item) => item.user.public_id === data.public_id) : undefined;

  const actionBase = "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-default";
  let action: React.ReactNode = null;
  if (data && !isSelf) {
    if (relation?.status === "accepted") {
      action = (
        <button type="button" disabled className={`${actionBase} border border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300`}>
          <Check className="h-3.5 w-3.5" />
          {t("room.playerInfo.friends")}
        </button>
      );
    } else if (relation?.status === "pending_sent") {
      action = (
        <button type="button" disabled className={`${actionBase} border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400`}>
          <Clock className="h-3.5 w-3.5" />
          {t("room.playerInfo.requestPending")}
        </button>
      );
    } else if (relation?.status === "pending_received") {
      action = (
        <button
          type="button"
          disabled={acceptMutation.isPending}
          onClick={() => acceptMutation.mutate(relation.public_id)}
          className={`${actionBase} bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400`}
        >
          <Check className="h-3.5 w-3.5" />
          {t("room.playerInfo.acceptRequest")}
        </button>
      );
    } else {
      action = (
        <button
          type="button"
          disabled={addMutation.isPending}
          onClick={() => addMutation.mutate(data.public_id)}
          className={`${actionBase} bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("room.playerInfo.addFriend")}
        </button>
      );
    }
  }

  return (
    <aside className="absolute top-4 left-4 z-50 w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border border-sky-200/80 bg-white/92 p-3 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-slate-600/60 dark:bg-slate-900/90 dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.75)]">
      <button
        type="button"
        onClick={closeCard}
        aria-label={t("room.playerInfo.close")}
        className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700/70 dark:hover:text-slate-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {isLoading ? (
        <section className="flex items-center gap-3" aria-busy="true" aria-live="polite">
          <Skeleton className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-700/70" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-700/70" />
            <Skeleton className="h-3 w-24 rounded-md bg-slate-200 dark:bg-slate-700/60" />
          </div>
        </section>
      ) : isError || !data ? (
        <p className="pr-6 text-sm text-rose-700 dark:text-rose-300">{t("room.playerInfo.loadError")}</p>
      ) : (
        <>
          <div className="flex items-center gap-3 pr-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sky-200/80 bg-slate-100 dark:border-slate-600 dark:bg-slate-800">
              {data.avatar_url ? (
                <img src={data.avatar_url} alt={data.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-slate-700 dark:text-slate-100">{getInitials(data.name)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">{data.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {t("room.playerInfo.memberSince")} {formatMemberSince(data.member_since, locale)}
              </p>
            </div>
          </div>

          <p className="mt-2.5 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{data.description?.trim() || t("room.playerInfo.noDescription")}</p>

          {action ? <div className="mt-3">{action}</div> : null}
        </>
      )}
    </aside>
  );
}
