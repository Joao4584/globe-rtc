"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { useI18n } from "@/locales/client";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/modules/shared/ui/dialog";
import { cn } from "@/modules/shared/utils";
import { CharacterCreator } from "./character-creator";

// The character creator as a popup, opened from the header. The creator only mounts while it is open, so nothing is loaded before that.
export function CharacterDialog({ showLabel = false }: { showLabel?: boolean }) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const title = t("dashboard.menu.character");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground data-[state=open]:bg-primary/15 data-[state=open]:text-foreground",
            showLabel && "w-full",
          )}
        >
          <UserRound className="h-4 w-4" />
          <span className={showLabel ? undefined : "hidden sm:inline"}>{title}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto mobile:left-0 mobile:top-0 mobile:h-dvh mobile:max-h-dvh mobile:w-screen mobile:max-w-none mobile:translate-x-0 mobile:translate-y-0 mobile:flex mobile:flex-col mobile:overflow-hidden mobile:rounded-none mobile:border-0 mobile:p-3">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {open ? <CharacterCreator /> : null}
      </DialogContent>
    </Dialog>
  );
}
