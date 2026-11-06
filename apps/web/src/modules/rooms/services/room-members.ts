import { api } from "@/modules/shared/http/api-client";

export type RoomRole = "owner" | "admin" | "member" | "visitor";

export type RoomMember = {
  public_id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  role: Exclude<RoomRole, "visitor">;
};

export type RoomMembersOutput = {
  my_role: RoomRole;
  members: RoomMember[];
};

export type UpdateRoomInput = {
  name?: string;
  description?: string | null;
  public?: boolean;
  password?: string;
};

export async function getRoomMembers(roomPublicId: string) {
  return api.get(`room/${roomPublicId}/members`).json<RoomMembersOutput>();
}

export async function addRoomMember(roomPublicId: string, userPublicId: string, role: "member" | "admin") {
  return api.post(`room/${roomPublicId}/members`, { json: { user_public_id: userPublicId, role } }).json<RoomMember>();
}

export async function setRoomMemberRole(roomPublicId: string, userPublicId: string, role: "member" | "admin") {
  return api.patch(`room/${roomPublicId}/members/${userPublicId}`, { json: { role } }).json<{ updated: boolean }>();
}

export async function removeRoomMember(roomPublicId: string, userPublicId: string) {
  return api.delete(`room/${roomPublicId}/members/${userPublicId}`).json<{ removed: boolean }>();
}

export async function updateRoom(roomPublicId: string, data: UpdateRoomInput) {
  return api.patch(`room/${roomPublicId}`, { json: data }).json<{ updated: boolean }>();
}
