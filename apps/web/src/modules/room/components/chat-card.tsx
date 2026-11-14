"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { useI18n } from "@/locales/client";
import { useIsMobile } from "@/modules/shared/hooks/use-mobile";
import { CHAT_MESSAGE_MAX_CHARS } from "@/modules/shared/config/phaser-js/chat-config";
import { useRoomActions } from "../hooks/use-room-actions";
import { useRoomStore } from "../stores/room-store";
import { useRoomUiStore } from "../stores/room-ui-store";

type ChatLine = { key: string; id: string; name: string; color: string; text: string };

// Messages kept in memory (scroll up to read them); about 5 lines are visible, older ones fade at the top edge.
const MAX_LINES = 60;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHADOW = "[text-shadow:0_1px_2px_rgba(0,0,0,0.95)]";

// Game-style chat: the message log of the room above a slim input. Enter sends.
export function ChatCard() {
  const t = useI18n();
  const room = useRoomStore((s) => s.room);
  const chatMessage = useRoomUiStore((s) => s.chatMessage);
  const setChatMessage = useRoomUiStore((s) => s.setChatMessage);
  const { sendChat, setGameFocus } = useRoomActions();
  const [lines, setLines] = useState<ChatLine[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  // The top fade only shows once there are more lines than fit (a short log must not start faded).
  const [overflowing, setOverflowing] = useState(false);
  const counter = useRef(0);
  // Phones: the chat is a round button; tapping it opens the log and the input.
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const collapsed = isMobile && !open;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const selfIdRef = useRef<string | undefined>(undefined);
  selfIdRef.current = room?.sessionId;

  useEffect(() => {
    if (!room) return;
    setLines([]);
    const off = room.onMessage("chat_message", (payload: { id?: string; name?: string; color?: string; text?: string }) => {
      if (typeof payload?.text !== "string" || !payload.text) return;
      const line: ChatLine = {
        key: `${Date.now()}-${counter.current++}`,
        id: payload.id ?? "",
        name: typeof payload.name === "string" && payload.name ? payload.name : "?",
        color: typeof payload.color === "string" && HEX_COLOR.test(payload.color) ? payload.color : "#7dd3fc",
        text: payload.text,
      };
      setLines((current) => [...current.slice(-(MAX_LINES - 1)), line]);
      if (collapsedRef.current && line.id !== selfIdRef.current) setUnread((count) => count + 1);
    });
    return () => {
      if (typeof off === "function") off();
    };
  }, [room]);

  // Follow new messages unless the player scrolled up to read older ones.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (stickRef.current) list.scrollTop = list.scrollHeight;
    setOverflowing(list.scrollHeight > list.clientHeight + 1);
  }, [lines]);

  const selfId = room?.sessionId;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setUnread(0);
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }}
        aria-label={t("room.chat.open")}
        className="absolute bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-sm active:scale-95"
      >
        <MessageCircle className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)]">
      {lines.length > 0 ? (
        <div
          ref={listRef}
          onScroll={(event) => {
            const list = event.currentTarget;
            stickRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 8;
          }}
          className={`mb-1.5 max-h-[7.5rem] overflow-y-auto overscroll-contain rounded-md bg-black/25 px-2 py-1 text-[13px] leading-[1.35] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${overflowing ? "[mask-image:linear-gradient(to_bottom,transparent,black_40%)]" : ""}`}
        >
          {lines.map((line) => (
            <p key={line.key} className={`break-words text-white/95 ${SHADOW}`}>
              <span className={`font-semibold ${line.id === selfId ? "underline decoration-white/30 underline-offset-2" : ""}`} style={{ color: line.color }}>
                {line.name}
              </span>
              <span className="text-white/60">: </span>
              {line.text}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/40 p-1 backdrop-blur-sm focus-within:border-white/25 focus-within:bg-black/55">
        <input
          ref={inputRef}
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value.slice(0, CHAT_MESSAGE_MAX_CHARS))}
          maxLength={CHAT_MESSAGE_MAX_CHARS}
          placeholder={t("room.chat.placeholder")}
          onFocus={() => setGameFocus(false)}
          onBlur={() => setGameFocus(true)}
          onKeyDownCapture={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendChat();
            }
          }}
          className="h-7 min-w-0 flex-1 bg-transparent px-2 text-[13px] text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={sendChat}
          disabled={!room || !chatMessage.trim()}
          aria-label={t("room.chat.send")}
          title={t("room.chat.send")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
        {isMobile ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              inputRef.current?.blur();
            }}
            aria-label={t("room.chat.close")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
