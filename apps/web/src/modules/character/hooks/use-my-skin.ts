import { useQuery } from "@tanstack/react-query";
import { getMySkin } from "../services/character";
import { skinFromSavedUrl } from "@/modules/room/lib/skin-assets";

export const MY_SKIN_KEY = ["my-skin"] as const;

// The character the user saved (null until they create one) and the skin string the game uses for it.
export function useMySkin() {
  const query = useQuery({ queryKey: MY_SKIN_KEY, queryFn: getMySkin });
  return { ...query, skin: skinFromSavedUrl(query.data?.url) };
}
