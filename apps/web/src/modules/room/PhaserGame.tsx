"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { PhaserGameProps } from "./@types/phaser";
import { useRoomStore } from "./stores/room-store";
import { useColyseusRoom } from "./hooks/use-colyseus-room";
import { usePhaserGame } from "./hooks/use-phaser-game";
import { usePhaserResize } from "./hooks/use-phaser-resize";
import { getScaleMode } from "./lib/phaser-config";
import { prepareTemplateMap, type TemplateMapData } from "./lib/template-map";

// Componente de integracao entre React e Phaser:
// conecta na sala, cria o jogo e sincroniza callbacks com o estado global da room.
export const PhaserGame: React.FC<PhaserGameProps> = ({ skin, ghost, userId, displayName, isAdmin, roomPublicId, map, onSceneReady, onRoomConnected }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const setRoom = useRoomStore((s) => s.setRoom);
  const setFocusGame = useRoomStore((s) => s.setFocusGame);
  const setKeyboardToggle = useRoomStore((s) => s.setKeyboardToggle);

  const { resolvedTheme, theme } = useTheme();
  const activeTheme = resolvedTheme ?? theme;
  const backgroundColor = activeTheme === "light" ? "#4fbeff" : "#0b1220";

  // The room map (made in the editor) is cut into pictures before the game starts; undefined = still preparing.
  const [templateMap, setTemplateMap] = useState<TemplateMapData | null | undefined>(map ? undefined : null);
  useEffect(() => {
    if (!map) {
      setTemplateMap(null);
      return;
    }
    let cancelled = false;
    prepareTemplateMap(map)
      .then((prepared) => !cancelled && setTemplateMap(prepared))
      .catch(() => !cancelled && setTemplateMap(null));
    return () => {
      cancelled = true;
    };
  }, [map]);

  const { room, error } = useColyseusRoom({ skin, ghost, userId, displayName, isAdmin, roomPublicId });
  const { gameRef } = usePhaserGame({
    containerRef,
    room,
    backgroundColor,
    templateMap,
    onSceneReady,
    setFocusGame,
    setKeyboardToggle,
  });

  // Mantem o canvas Phaser responsivo ao tamanho do container.
  usePhaserResize({ containerRef, gameRef });

  // Mantem o store com a referencia atual da sala conectada.
  useEffect(() => {
    setRoom(room ?? undefined);
    return () => setRoom(undefined);
  }, [room, setRoom]);

  // Dispara o callback quando a conexao com a sala estiver pronta.
  useEffect(() => {
    if (!room || !onRoomConnected) return;
    onRoomConnected();
  }, [room, onRoomConnected]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-rose-700 dark:bg-slate-900 dark:text-red-200">
        {error}
      </div>
    );
  }

  return <div id="phaser-game-container" data-scale-mode={getScaleMode()} ref={containerRef} style={{ width: "100%", height: "100%", backgroundColor }} />;
};
