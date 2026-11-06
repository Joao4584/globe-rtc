import { useQuery } from "@tanstack/react-query";
import { getRoomMembers } from "../services/room-members";
import { getRoomOnline } from "../services/get-room-online";

export function useRoomMembers(roomPublicId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["rooms:members", roomPublicId],
    queryFn: () => getRoomMembers(roomPublicId as string),
    enabled: Boolean(roomPublicId) && enabled,
    retry: false,
  });
}

/** Players inside the room right now (polled; the game-server hides invisible players). */
export function useRoomOnline(roomPublicId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["rooms:online", roomPublicId],
    queryFn: () => getRoomOnline(roomPublicId as string),
    enabled: Boolean(roomPublicId) && enabled,
    refetchInterval: 8000,
    retry: false,
  });
}
