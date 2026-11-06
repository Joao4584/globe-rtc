import { api } from "@/modules/shared/http/api-client";
import { normalizeRoomListItem, type GetRoomsOptions, type RoomListItem, type RoomListItemApi } from "./get-rooms";

export async function getUserRooms(userPublicId: string, options: GetRoomsOptions = {}): Promise<RoomListItem[]> {
  const rooms = await api
    .get(`room/user/${userPublicId}`, {
      searchParams: options.sort ? { sort: options.sort } : undefined,
    })
    .json<RoomListItemApi[]>();

  return rooms.map(normalizeRoomListItem);
}
