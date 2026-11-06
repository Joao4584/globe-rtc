"use server";

import {
  postIntegrationService,
  type IntegrationInput,
} from "../services/post-integration";
import { cookies } from "next/headers";
import { HTTPError } from "ky";
import { storageKey } from "@/modules/shared/config/storage-key";

export async function integrationAction(params: IntegrationInput) {
  try {
    const response = await postIntegrationService(params);
    const cookieStore = await cookies();
    cookieStore.set(`${storageKey}session`, response.accessToken);
  } catch (error) {
    let message = "An unexpected error occurred.";
    if (error instanceof HTTPError) {
      const body = await error.response.json().catch(() => null);
      message = body?.message ?? message;
    }
    console.error("[auth] integration failed:", message);
    return {
      success: false,
      message,
    };
  }
  return {
    success: true,
    message: "Login successful.",
  };
}
