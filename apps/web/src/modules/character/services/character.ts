import type { ApiResponse } from "@/modules/shared/@types/api-response";
import { api } from "@/modules/shared/http/api-client";

export type SkinType = "adult" | "kid";
export type SkinPart = "body" | "eyes" | "outfit" | "hairstyle" | "accessory";

/** One piece id per part, `null` = none (only hairstyle and accessory). Same shape as the skin generator package. */
export interface SkinSelection {
  type: SkinType;
  body: string;
  eyes: string;
  outfit: string;
  hairstyle: string | null;
  accessory: string | null;
}

/** Pieces of the same style in their colour variants (piece ids). */
export interface SkinStyleGroup {
  style: string;
  variants: string[];
}

export type SkinCatalog = Record<SkinType, Partial<Record<SkinPart, SkinStyleGroup[]>>>;

export interface SkinAnimationLayout {
  name: string;
  row: number;
  frames: number;
  directions: string[];
  framesPerDirection: number;
}

export interface SkinSheetLayout {
  frameWidth: number;
  frameHeight: number;
  animations: SkinAnimationLayout[];
}

export interface RenderedSkin {
  selection: SkinSelection;
  /** PNG data URL with every animation, one per row. */
  spritesheet: string;
  layout: SkinSheetLayout;
}

export async function getSkinCatalog(): Promise<SkinCatalog> {
  const response = await api.get("skin/catalog").json<ApiResponse<SkinCatalog>>();
  return response.data;
}

export async function renderSkin(selection: SkinSelection): Promise<RenderedSkin> {
  const response = await api.post("skin/render", { json: { selection } }).json<ApiResponse<RenderedSkin>>();
  return response.data;
}

/** A random skin of this type (every part rolled). */
export async function rollSkin(type: SkinType): Promise<SkinSelection> {
  const response = await api.get("skin/generate", { searchParams: { type, format: "json" } }).json<{ selection: SkinSelection }>();
  return response.selection;
}

export async function saveSkin(selection: SkinSelection): Promise<void> {
  await api.patch("user/me/skin", { json: { selection } });
}
