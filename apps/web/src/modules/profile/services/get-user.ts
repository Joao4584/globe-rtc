import type { ApiResponse } from "@/modules/shared/@types/api-response";
import { api } from "@/modules/shared/http/api-client";

interface GetUserOutput {
  name: string;
  username: string;
  email: string;
  avatar_url: string;
  public_id: string;
  character_key: string | null;
  /** The character built in the Character page (null until the user creates one). */
  skin?: Record<string, unknown> | null;
}

export async function getUser(): Promise<GetUserOutput> {
  const response = await api.get("user/me").json<ApiResponse<GetUserOutput>>();
  return response.data;
}
