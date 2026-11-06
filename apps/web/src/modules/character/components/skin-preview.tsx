"use client";

import React, { useEffect, useState } from "react";
import type { SkinSheetLayout } from "../services/character";

const FRAME_MS: Record<string, number> = { idle: 220, walk: 120, sit: 250, throw: 90, punch: 110, hurt: 140 };

type SkinPreviewProps = {
  sheet: string;
  layout: SkinSheetLayout;
  animation: string;
  direction: string;
  /** Pixel multiplier of the 32x64 frame. */
  scale?: number;
};

// Plays one animation of the spritesheet in one direction by moving the background, nothing is cut out of the image.
export function SkinPreview({ sheet, layout, animation, direction, scale = 6 }: SkinPreviewProps) {
  const [frame, setFrame] = useState(0);
  const info = layout.animations.find((item) => item.name === animation) ?? layout.animations[0];
  const directionIndex = Math.max(0, info.directions.indexOf(direction));

  useEffect(() => {
    setFrame(0);
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % info.framesPerDirection), FRAME_MS[info.name] ?? 150);
    return () => window.clearInterval(timer);
  }, [info.name, info.framesPerDirection, directionIndex]);

  const sheetWidth = Math.max(...layout.animations.map((item) => item.frames)) * layout.frameWidth;
  const sheetHeight = layout.animations.length * layout.frameHeight;
  const column = directionIndex * info.framesPerDirection + frame;

  return (
    <div
      role="img"
      aria-label="character preview"
      style={{
        width: layout.frameWidth * scale,
        height: layout.frameHeight * scale,
        backgroundImage: `url(${sheet})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheetWidth * scale}px ${sheetHeight * scale}px`,
        backgroundPosition: `-${column * layout.frameWidth * scale}px -${info.row * layout.frameHeight * scale}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}
