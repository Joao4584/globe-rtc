"use client";

import React, { useEffect, useRef } from "react";
import * as Phaser from "phaser";
import type { Brush } from "./assets/map-assets";
import type { LayerState, MapLayer } from "./assets/map-layers";
import { BuilderScene, type BuilderController, type CursorTile, type HistoryState } from "./scenes/builder-scene";

type BuilderGameProps = {
  mapId: string;
  initialData?: unknown;
  defaultLayers: MapLayer[];
  brush: Brush | null;
  onCursorChange?: (tile: CursorTile) => void;
  onBrushClear?: () => void;
  onLayersChange?: (state: LayerState) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onHistoryChange?: (state: HistoryState) => void;
  /** Gives the page the object that edits the layers and reads the map to save it (null when the game is torn down). */
  onController?: (controller: BuilderController | null) => void;
};

// Mounts the Phaser map-building canvas; it fills its parent and resizes with it.
export const BuilderGame: React.FC<BuilderGameProps> = ({ mapId, initialData, defaultLayers, brush, onCursorChange, onBrushClear, onLayersChange, onDirtyChange, onHistoryChange, onController }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BuilderScene | null>(null);
  const brushRef = useRef(brush);
  const defaultLayersRef = useRef(defaultLayers);
  const initialDataRef = useRef(initialData);
  const callbacks = useRef({ onCursorChange, onBrushClear, onLayersChange, onDirtyChange, onHistoryChange, onController });
  brushRef.current = brush;
  callbacks.current = { onCursorChange, onBrushClear, onLayersChange, onDirtyChange, onHistoryChange, onController };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new BuilderScene({
      initialData: initialDataRef.current,
      defaultLayers: defaultLayersRef.current,
      onCursorChange: (tile) => callbacks.current.onCursorChange?.(tile),
      onBrushClear: () => callbacks.current.onBrushClear?.(),
      onLayersChange: (state) => callbacks.current.onLayersChange?.(state),
      onDirtyChange: (dirty) => callbacks.current.onDirtyChange?.(dirty),
      onHistoryChange: (state) => callbacks.current.onHistoryChange?.(state),
    });
    scene.setBrush(brushRef.current);
    sceneRef.current = scene;
    callbacks.current.onController?.(scene);

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#000000",
      pixelArt: true,
      scene: [scene],
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    });

    return () => {
      sceneRef.current = null;
      callbacks.current.onController?.(null);
      game.destroy(true);
    };
  }, [mapId]);

  useEffect(() => {
    sceneRef.current?.setBrush(brush);
  }, [brush]);

  return <div ref={containerRef} className="h-full w-full" />;
};
