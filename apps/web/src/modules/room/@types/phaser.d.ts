export type PhaserGameProps = {
  skin: string;
  ghost?: boolean;
  userId?: string | null;
  displayName?: string | null;
  isAdmin?: boolean;
  roomPublicId: string;
  /** Saved map JSON of the room template; null/undefined = the original map. */
  map?: Record<string, unknown> | null;
  onSceneReady?: () => void;
  onRoomConnected?: () => void;
};

export type CreatePhaserGameOptions = {
  parent?: HTMLElement | null;
  room: Room<PlaygroundState>;
  backgroundColor?: string;
  templateMap?: import("../lib/template-map").TemplateMapData | null;
  onSceneReady?: () => void;
};
