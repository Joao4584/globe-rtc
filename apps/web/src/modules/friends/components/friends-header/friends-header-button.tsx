"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, X } from "lucide-react";
import { useI18n } from "@/locales/client";
import { useListFriends } from "../../hooks/use-friends";
import { FriendListTable } from "../list-friends/table-friends";

// Dialogs/menus opened from inside the panel render in portals (outside its DOM node).
// Clicking them must not count as "clicking outside".
const PORTAL_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper], [data-sonner-toast]';

export function FriendsHeaderButton() {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data } = useListFriends();

  // Requests other people sent to me and I haven't answered yet.
  const pendingReceived = (data?.recent_requests ?? []).filter((item) => item.status === "pending_received").length;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || rootRef.current?.contains(target)) return;
      if (target.closest(PORTAL_SELECTOR)) return;
      // A dialog from the panel is still open: let it handle its own outside click first.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"], [role="alertdialog"]')) setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("dashboard.friends.panel.open")}
        aria-expanded={open}
        title={t("dashboard.friends.panel.open")}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Users className="h-4 w-4" />
        {pendingReceived > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-none text-white">
            {pendingReceived}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{ transformOrigin: "top right", height: "min(560px, 70vh)", maxWidth: "calc(100vw - 2rem)" }}
            className="absolute right-0 top-full z-50 mt-2 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg shadow-black/20 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{t("dashboard.friends.panel.title")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.friends.panel.description")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("dashboard.friends.panel.close")}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <FriendListTable />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
