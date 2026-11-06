import { api } from "@/modules/shared/http/api-client";

export interface JoinRoomParticipantOutput {
  public_id: string;
  room_id: number;
  user_id: number;
  is_admin: boolean;
  joined_at: string;
}

export async function joinRoom(roomPublicId: string): Promise<JoinRoomParticipantOutput> {
  return api.post(`room/${roomPublicId}/participants/join`).json<JoinRoomParticipantOutput>();
}
