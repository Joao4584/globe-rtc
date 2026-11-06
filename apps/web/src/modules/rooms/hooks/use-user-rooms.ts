import { useQuery } from "@tanstack/react-query";
import { getUserRooms } from "../services/get-user-rooms";
import type { GetRoomsOptions } from "../services/get-rooms";

export function useUserRooms(userPublicId: string | undefined, options?: GetRoomsOptions) {
  const sortKey = options?.sort ?? "recent";
  return useQuery({
    queryKey: ["rooms:friend", userPublicId, sortKey],
    queryFn: () => getUserRooms(userPublicId as string, options),
    enabled: Boolean(userPublicId),
  });
}
