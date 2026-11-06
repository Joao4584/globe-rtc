import { api } from "@/modules/shared/http/api-client";

export type CreateRoomInput = {
  name: string;
  description?: string;
  public: boolean;
  password?: string;
  /** public id of one of the user's map templates (the room's map) */
  map_template_id: string;
};

export type CreateRoomResponse = {
  message: string;
  room: {
    public_id: string;
  };
};

export async function createRoom(data: CreateRoomInput) {
  return api.post("room", { json: data }).json<CreateRoomResponse>();
}
