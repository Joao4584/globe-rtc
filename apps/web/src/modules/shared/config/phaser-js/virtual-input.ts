// Touch controls state: the on-screen joystick (React, modules/room/components/touch-controls.tsx) writes here and the
// Player reads it every frame next to the keyboard (WASD / arrows / Shift). x and y are -1..1, 0 = centred.
export const virtualInput = { x: 0, y: 0, sprint: false };

/** Below this the stick counts as centred. */
export const VIRTUAL_DEADZONE = 0.3;

export function resetVirtualInput() {
  virtualInput.x = 0;
  virtualInput.y = 0;
  virtualInput.sprint = false;
}
