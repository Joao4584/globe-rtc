import { api } from "@/modules/shared/http/api-client";
import { normalizeApiImageUrl } from "./normalize-api-image-url";

export type RoomDetail = {
  public_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  url_image: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_owner: boolean;
  my_role: "owner" | "admin" | "member" | "visitor";
  can_edit: boolean;
  /** Saved map JSON of the room template (null: the default map). */
  map: Record<string, unknown> | null;
};

export async function getRoomDetail(publicId: string): Promise<RoomDetail> {
  const room = await api.get(`room/${publicId}`).json<RoomDetail>();
  return {
    ...room,
    url_image: normalizeApiImageUrl(room.url_image),
  };
}
