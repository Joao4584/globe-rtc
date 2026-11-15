import {
  PLAYER_RADIUS_Y_OFFSET,
  PLAYER_RADIUS_Y_SCALE,
} from "./player-radius";

export type RemoteSummary = {
  id: string;
  name: string;
  x: number;
  y: number;
};

/** Remotes inside the radius ellipse (closest first), with the id of the remote and the distance in px. */
export function getNearbyEntries(remotes: RemoteSummary[], centerX: number, centerY: number, radius: number) {
  const rx = radius;
  const ry = radius * PLAYER_RADIUS_Y_SCALE;
  return remotes
    .map((remote) => {
      const dx = remote.x - centerX;
      const dy = remote.y - (centerY + PLAYER_RADIUS_Y_OFFSET);
      const ellipse = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (ellipse > 1) return null;
      return { id: remote.id, name: remote.name, distance: Math.sqrt(dx * dx + dy * dy) };
    })
    .filter((entry): entry is { id: string; name: string; distance: number } => !!entry)
    .sort((a, b) => a.distance - b.distance);
}

export function getNearbyPlayers(remotes: RemoteSummary[], centerX: number, centerY: number, radius: number) {
  return getNearbyEntries(remotes, centerX, centerY, radius).map((entry) => entry.name);
}
