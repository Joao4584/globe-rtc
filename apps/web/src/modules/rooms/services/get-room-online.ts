import { resolveServerUrl } from "@/modules/room/utils/server-url";

export type RoomOnlinePlayer = { id: string; name: string };

export type RoomOnlineOutput = { count: number; players: RoomOnlinePlayer[] };

// The game-server (Colyseus) is the source of truth for who is inside a room right now.
export async function getRoomOnline(roomPublicId: string): Promise<RoomOnlineOutput> {
  const baseUrl = resolveServerUrl().replace(/^ws/, "http");
  const response = await fetch(`${baseUrl}/rooms/${encodeURIComponent(roomPublicId)}/online`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load online players");
  return (await response.json()) as RoomOnlineOutput;
}
