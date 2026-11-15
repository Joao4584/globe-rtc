"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/locales/client";
import { Button } from "@/modules/shared/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/modules/shared/ui/sheet";
import { useIsMobile } from "@/modules/shared/hooks/use-mobile";
import { toast } from "sonner";
import { AlertCircle, Menu, Share2 } from "lucide-react";
import Image from "next/image";
import { FriendsHeaderButton } from "@/modules/friends/components/friends-header/friends-header-button";
import { CreateRoom } from "@/modules/rooms/components/create-room/create-room";
import { CharacterDialog } from "@/modules/character/components/character-dialog";
import { HeaderNav } from "./header-nav";
import UserProfileHeader from "@/modules/profile/components/layout/profile/profile-header";

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  const t = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isRoomRoute = Boolean(pathname?.includes("/app/room/"));

  const handleShareRoom = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = url;
        tempInput.setAttribute("readonly", "true");
        tempInput.style.position = "fixed";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }

      toast(t("dashboard.header.copySuccessTitle"), {
        description: t("dashboard.header.copySuccessDescription"),
        icon: <AlertCircle />,
      });
    } catch {
      toast(t("dashboard.header.copyErrorTitle"), {
        description: t("dashboard.header.copyErrorDescription"),
      });
    }
  };

  // Going to another page closes the phone menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Phones: a slim bar (logo + menu button); everything else lives in the menu.
  if (isMobile) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/70">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <Image src="/meta-rtc-logo.png" width={84} height={49} alt="Globe RTC" priority />
          <div className="flex items-center gap-2">
            <FriendsHeaderButton />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="icon" aria-label={t("dashboard.header.menu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-72 flex-col gap-4 overflow-y-auto p-4">
              <SheetTitle className="sr-only">{t("dashboard.header.menu")}</SheetTitle>
              <SheetDescription className="sr-only">{t("dashboard.header.menu")}</SheetDescription>
              <div className="pt-6">
                <UserProfileHeader />
              </div>
              <CreateRoom />
              <div className="flex flex-col gap-1">
                <HeaderNav vertical />
                <CharacterDialog showLabel />
              </div>
              {isRoomRoute && (
                <Button variant="secondary" size="sm" className="mt-auto" onClick={handleShareRoom}>
                  <Share2 />
                  {t("dashboard.header.share")}
                </Button>
              )}
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/70">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-fit items-center gap-6">
          <Image src="/meta-rtc-logo.png" width={120} height={70} alt="Globe RTC" />
          <CreateRoom />
          <HeaderNav />
        </div>
        <div className="flex items-center gap-2">
          {isRoomRoute && (
            <Button variant="secondary" size="sm" onClick={handleShareRoom}>
              <Share2 />
              {t("dashboard.header.share")}
            </Button>
          )}
          <CharacterDialog />
          <FriendsHeaderButton />
          <UserProfileHeader />
        </div>
      </div>
    </header>
  );
}
