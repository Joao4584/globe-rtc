"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/locales/client";
import { useRoomActions } from "./hooks/use-room-actions";
import { useQueryState } from "nuqs";
import { ChatCard } from "./components/chat-card";
import { FocusReturnButton } from "./components/focus-return-button";
import { NearbyPlayers } from "./components/nearby-players";
import { PingCard } from "./components/ping-card";
import { PlayerInfoCard } from "./components/player-info-card";
import { InvisibilityCard } from "./components/invisibility-card";
import { useUser } from "@/modules/profile/hooks/use-user";
import type { RoomDetail } from "../rooms/services/get-room-detail";
import { useMySkin } from "@/modules/character/hooks/use-my-skin";
import { useRoomUiStore } from "./stores/room-ui-store";
import { useRoomStore } from "./stores/room-store";
import { useRoomUploadImages } from "./hooks/use-room-upload-images";
import { useSounds } from "@/modules/shared/hooks/use-sounds";
import { formatDisplayName } from "@/modules/shared/utils";
import { joinRoom } from "./services/join-room";
import { verifyRoomAccessToken, verifyRoomPassword } from "./services/verify-room-password";
import { Settings2 } from "lucide-react";
import { ManageRoomDialog } from "@/modules/rooms/components/manage-room/manage-room-dialog";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";

const DynamicPhaserGame = dynamic(() => import("./PhaserGame").then((mod) => mod.PhaserGame), {
  ssr: false,
});

interface RoomPageProps {
  room: RoomDetail;
}

let refetchRoomUploadsHandler: null | (() => Promise<void>) = null;
const roomAccessSessionKey = (roomPublicId: string) => `room-access-token:${roomPublicId}`;

export async function refetchRoomUploads() {
  if (!refetchRoomUploadsHandler) {
    console.warn("[room] refetch handler is not available");
    return;
  }
  await refetchRoomUploadsHandler();
}

export default function RoomPage(props: RoomPageProps) {
  const t = useI18n();
  const [idParam] = useQueryState("id");
  const { setGameFocus } = useRoomActions();

  const { data: user, isLoading: isLoadingUser } = useUser();
  const userId = user?.public_id ?? (idParam ? idParam.toString().slice(0, 32) : null);
  const displayName = formatDisplayName(user?.name);
  const { skin, isLoading: isLoadingSkin } = useMySkin();
  const invisibleMode = useRoomUiStore((s) => s.invisibleMode);
  const room = useRoomStore((s) => s.room);
  const { refetchRoomUploads: refetchRoomUploadsFromHook } = useRoomUploadImages(props.room.public_id);
  const sounds = useSounds();
  const [roomPassword, setRoomPassword] = useState("");
  const [roomPasswordError, setRoomPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [checkingSavedAccessToken, setCheckingSavedAccessToken] = useState(!props.room.is_public);
  const [hasRoomAccess, setHasRoomAccess] = useState(props.room.is_public);
  const [isAdmin, setIsAdmin] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [checkingParticipantRole, setCheckingParticipantRole] = useState(Boolean(props.room.is_public));
  const canMountGame = props.room.is_public || hasRoomAccess;
  // The game waits for the saved character, so the player joins already wearing it.
  const canConnectToGame = canMountGame && !checkingParticipantRole && !isLoadingSkin;

  useEffect(() => {
    if (props.room.is_public) {
      setHasRoomAccess(true);
      setCheckingSavedAccessToken(false);
      return;
    }

    let cancelled = false;
    setCheckingSavedAccessToken(true);
    setHasRoomAccess(false);

    const checkSavedToken = async () => {
      let storedToken: string | null = null;

      try {
        storedToken = window.sessionStorage.getItem(roomAccessSessionKey(props.room.public_id));
      } catch {
        storedToken = null;
      }

      if (!storedToken && props.room.my_role && props.room.my_role !== "visitor") {
        // Owner, admins and members skip the password: the API issues the access token for them.
        try {
          const granted = await verifyRoomPassword(props.room.public_id, "member-access");
          if (granted.accessToken) {
            storedToken = granted.accessToken;
            try {
              window.sessionStorage.setItem(roomAccessSessionKey(props.room.public_id), granted.accessToken);
            } catch {
              // Ignore storage failures; the token is still used below.
            }
          }
        } catch {
          // Not a member after all: fall back to the password form.
        }
      }

      if (!storedToken) {
        if (!cancelled) {
          setCheckingSavedAccessToken(false);
        }
        return;
      }

      try {
        const result = await verifyRoomAccessToken(props.room.public_id, storedToken);
        if (!cancelled) {
          setHasRoomAccess(Boolean(result.authorized));
        }
      } catch {
        try {
          window.sessionStorage.removeItem(roomAccessSessionKey(props.room.public_id));
        } catch {
          // Ignore storage failures.
        }
        if (!cancelled) {
          setHasRoomAccess(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingSavedAccessToken(false);
        }
      }
    };

    void checkSavedToken();

    return () => {
      cancelled = true;
    };
  }, [props.room.is_public, props.room.public_id, props.room.my_role]);

  const handleRoomConnected = useCallback(() => {
    void sounds.play("join-room").then((played) => {
      if (!played) {
        sounds.armUnlockOnFirstInteraction();
      }
    });
  }, [sounds]);

  // Prepara fallback para tocar o som na primeira interacao do usuario.
  useEffect(() => {
    sounds.armUnlockOnFirstInteraction();
  }, [sounds]);

  // Sincroniza invisibilidade com a room em runtime (sem alterar profile/header).
  useEffect(() => {
    if (!room) return;
    room.send("set_ghost", {
      ghost: invisibleMode,
      skin,
    });
  }, [room, invisibleMode, skin]);

  useEffect(() => {
    if (!canMountGame) {
      setIsAdmin(false);
      setCheckingParticipantRole(false);
      return;
    }

    if (isLoadingUser) {
      setCheckingParticipantRole(true);
      return;
    }

    if (!user?.public_id) {
      setIsAdmin(false);
      setCheckingParticipantRole(false);
      return;
    }

    let cancelled = false;
    setCheckingParticipantRole(true);

    const syncParticipantRole = async () => {
      try {
        const participant = await joinRoom(props.room.public_id);
        if (!cancelled) {
          setIsAdmin(Boolean(participant.is_admin));
        }
      } catch (error) {
        console.error("[room] failed to resolve participant role", error);
        if (!cancelled) {
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setCheckingParticipantRole(false);
        }
      }
    };

    void syncParticipantRole();

    return () => {
      cancelled = true;
    };
  }, [canMountGame, isLoadingUser, props.room.public_id, user?.public_id]);

  const handleVerifyRoomPassword = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const password = roomPassword;

      if (!password || password.trim().length === 0) {
        setRoomPasswordError(t("room.page.passwordRequired"));
        return;
      }

      setVerifyingPassword(true);
      setRoomPasswordError(null);

      try {
        const result = await verifyRoomPassword(props.room.public_id, password);
        if (result.authorized) {
          const accessToken = result.accessToken;
          if (!accessToken) {
            throw new Error("Missing room access token");
          }

          setHasRoomAccess(true);
          setRoomPassword("");
          try {
            window.sessionStorage.setItem(roomAccessSessionKey(props.room.public_id), accessToken);
          } catch {
            // Ignore storage failures and proceed with in-memory access.
          }
        }
      } catch {
        setRoomPasswordError(t("room.page.passwordInvalid"));
      } finally {
        setVerifyingPassword(false);
      }
    },
    [props.room.public_id, roomPassword, t],
  );

  useEffect(() => {
    const previousTitle = document.title;
    const roomName = props.room.name?.trim() || "Room";
    document.title = `${roomName} | Globe RTC`;

    return () => {
      document.title = previousTitle;
    };
  }, [props.room.name]);

  // Registra refetch automatico/manual para uploads associados a sala.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refetchRoomUploadsFromHook("after_10s");
    }, 10000);

    refetchRoomUploadsHandler = async () => {
      await refetchRoomUploadsFromHook("manual");
    };

    return () => {
      window.clearTimeout(timeoutId);
      refetchRoomUploadsHandler = null;
    };
  }, [refetchRoomUploadsFromHook]);

  return (
    <div className="w-full h-full flex justify-center items-center overflow-hidden relative">
      <div className="pointer-events-none absolute left-4 top-4 z-50 max-w-[55vw] truncate text-sm font-semibold text-slate-700 dark:text-white">
        <span className="text-slate-500 dark:text-slate-300">{t("room.page.roomLabel")}</span> {props.room.name}
      </div>
      {checkingSavedAccessToken ? (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-200/80 bg-white/90 p-5 text-center shadow-2xl backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/90">
            <p className="text-sm text-slate-700 dark:text-slate-200">{t("room.page.checkingAccess")}</p>
          </div>
        </div>
      ) : canConnectToGame ? (
        <>
          <div
            className="w-full h-full"
            onClick={() => {
              setGameFocus(true);
            }}
          >
            <DynamicPhaserGame
              skin={skin}
              ghost={invisibleMode}
              userId={userId}
              displayName={displayName}
              isAdmin={isAdmin}
              roomPublicId={props.room.public_id}
              map={props.room.map}
              onRoomConnected={handleRoomConnected}
            />
          </div>
          <FocusReturnButton />
          {props.room.my_role && props.room.my_role !== "visitor" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute left-4 top-10 z-50 gap-2"
              onClick={() => setManageOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              {t("dashboard.roomManage.open")}
            </Button>
          ) : null}
          <ManageRoomDialog roomPublicId={props.room.public_id} open={manageOpen} onOpenChange={setManageOpen} />
          <PingCard />
          <PlayerInfoCard />
          <NearbyPlayers />
          <InvisibilityCard />
          <ChatCard />
        </>
      ) : canMountGame ? (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-200/80 bg-white/90 p-5 text-center shadow-2xl backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/90">
            <p className="text-sm text-slate-700 dark:text-slate-200">{t("room.page.checkingAccess")}</p>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-200/80 bg-white/92 p-5 shadow-2xl backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/90">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("room.page.privateBadge")}</p>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{props.room.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t("room.page.privateDescription")}</p>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleVerifyRoomPassword}>
              <div className="space-y-2">
                <label htmlFor="room-access-password" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t("room.page.passwordLabel")}
                </label>
                <Input
                  id="room-access-password"
                  type="password"
                  value={roomPassword}
                  onChange={(event) => setRoomPassword(event.target.value)}
                  placeholder={t("room.page.passwordPlaceholder")}
                  autoComplete="current-password"
                  className="border-sky-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  disabled={verifyingPassword}
                />
              </div>

              {roomPasswordError ? <p className="text-sm text-rose-700 dark:text-rose-300">{roomPasswordError}</p> : null}

              <Button type="submit" className="w-full" disabled={verifyingPassword}>
                {verifyingPassword ? t("room.page.checking") : t("room.page.enterRoom")}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
