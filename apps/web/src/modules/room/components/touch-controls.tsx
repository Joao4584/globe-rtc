"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsRight } from "lucide-react";
import { resetVirtualInput, virtualInput } from "@/modules/shared/config/phaser-js/virtual-input";

const BASE = 112;
const KNOB = 48;
const RADIUS = (BASE - KNOB) / 2;

// On-screen joystick and run button for touch devices (small screens or a coarse pointer). They only write to
// `virtualInput`; the Player reads it like WASD / Shift, so nothing else in the game knows about touch.
export function TouchControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [running, setRunning] = useState(false);

  useEffect(() => resetVirtualInput, []);

  const moveStick = (clientX: number, clientY: number) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    virtualInput.x = dx / RADIUS;
    virtualInput.y = dy / RADIUS;
  };

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    virtualInput.x = 0;
    virtualInput.y = 0;
  };

  return (
    <div className="hidden max-md:block [@media(pointer:coarse)]:block">
      <div
        ref={baseRef}
        role="presentation"
        style={{ width: BASE, height: BASE, touchAction: "none" }}
        className="absolute bottom-6 left-5 z-50 select-none rounded-full border border-white/15 bg-black/35 backdrop-blur-sm"
        onPointerDown={(event) => {
          if (pointerId.current !== null) return;
          pointerId.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveStick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.pointerId === pointerId.current) moveStick(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (event.pointerId === pointerId.current) release();
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === pointerId.current) release();
        }}
      >
        <div
          style={{ width: KNOB, height: KNOB, transform: `translate(${knob.x}px, ${knob.y}px)`, left: (BASE - KNOB) / 2, top: (BASE - KNOB) / 2 }}
          className="pointer-events-none absolute rounded-full border border-white/30 bg-white/35 shadow-lg"
        />
      </div>

      <button
        type="button"
        aria-pressed={running}
        aria-label="Run"
        style={{ touchAction: "none" }}
        className={`absolute bottom-[5.25rem] right-4 z-50 flex h-11 w-11 select-none items-center justify-center rounded-full border backdrop-blur-sm transition ${
          running ? "border-sky-300/70 bg-sky-500/50 text-white" : "border-white/15 bg-black/35 text-white/80"
        }`}
        onPointerDown={() => {
          setRunning(true);
          virtualInput.sprint = true;
        }}
        onPointerUp={() => {
          setRunning(false);
          virtualInput.sprint = false;
        }}
        onPointerCancel={() => {
          setRunning(false);
          virtualInput.sprint = false;
        }}
        onPointerLeave={() => {
          setRunning(false);
          virtualInput.sprint = false;
        }}
      >
        <ChevronsRight className="h-5 w-5" />
      </button>
    </div>
  );
}
