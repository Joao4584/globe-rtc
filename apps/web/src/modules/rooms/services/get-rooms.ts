import { api } from "@/modules/shared/http/api-client";
import { normalizeApiImageUrl } from "./normalize-api-image-url";

export type RoomSort = "recent" | "alphabetical" | "players";

export type GetRoomsOptions = {
  sort?: RoomSort;
};

export interface RoomListItem {
  public_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  url_image: string | null;
  created_at: string;
  updated_at: string;
  participants_count: number;
  is_favorite: boolean;
}

export type RoomListItemApi = Omit<RoomListItem, "is_favorite"> & {
  is_favorite?: number | boolean;
};

export function normalizeRoomListItem(room: RoomListItemApi): RoomListItem {
  return {
    ...room,
    url_image: normalizeApiImageUrl(room.url_image),
    is_favorite: Boolean(room.is_favorite),
  };
}

export async function getRooms(options: GetRoomsOptions = {}): Promise<RoomListItem[]> {
  const rooms = await api
    .get("room/recent", {
      searchParams: options.sort ? { sort: options.sort } : undefined,
    })
    .json<RoomListItemApi[]>();

  return rooms.map(normalizeRoomListItem);
}
