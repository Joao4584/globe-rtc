import { api } from "@/modules/shared/http/api-client";

export type TemplateSort = "recent" | "alphabetical";

export interface MapTemplateItem {
  public_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface MapTemplateDetail extends MapTemplateItem {
  data: Record<string, unknown>;
}

export async function listMapTemplates(sort: TemplateSort = "recent"): Promise<MapTemplateItem[]> {
  const response = await api.get("map-template", { searchParams: { sort } }).json<{ data: MapTemplateItem[] }>();
  return response.data;
}

export async function getMapTemplate(publicId: string): Promise<MapTemplateDetail> {
  return api.get(`map-template/${publicId}`).json<MapTemplateDetail>();
}

export async function createMapTemplate(name: string) {
  return api.post("map-template", { json: { name } }).json<{ message: string; template: MapTemplateItem }>();
}

// Always overwrites the stored map of this template.
export async function saveMapTemplate(publicId: string, data: unknown) {
  return api.put(`map-template/${publicId}`, { json: { data } }).json<MapTemplateDetail>();
}

export async function deleteMapTemplate(publicId: string) {
  await api.delete(`map-template/${publicId}`);
}
