import { useQuery } from "@tanstack/react-query";
import { getMapTemplate, listMapTemplates, type TemplateSort } from "../services/map-templates";

export const MAP_TEMPLATES_KEY = "map-templates:list";

export function useMapTemplates(sort: TemplateSort) {
  return useQuery({
    queryKey: [MAP_TEMPLATES_KEY, sort],
    queryFn: () => listMapTemplates(sort),
  });
}

export function useMapTemplate(publicId: string | null) {
  return useQuery({
    queryKey: ["map-templates:detail", publicId],
    queryFn: () => getMapTemplate(publicId as string),
    enabled: Boolean(publicId),
    retry: false,
  });
}
