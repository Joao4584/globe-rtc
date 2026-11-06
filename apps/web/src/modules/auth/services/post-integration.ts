import { deriveInternalApiKey, env, INTERNAL_KEY_HEADER } from '@globe-rtc/env';
import { api } from '@/modules/shared/http/api-client';

export interface IntegrationInput {
  type: string;
  id: string;
  login: string;
  email: string;
  email_verified: boolean;
  name: string;
  avatar_url: string;
  github_link: string;
  bio: string;
}

interface LoginOutput {
  success: boolean;
  message: string;
  accessToken: string;
}

export async function postIntegrationService(credentials: IntegrationInput) {
  // Server-only: the API only accepts this route from our own server (see InternalOnlyGuard).
  // We send a key derived from NEXTAUTH_SECRET, never the secret itself. Never call this service from the browser.
  const secret = env.NEXTAUTH_SECRET;

  return await api
    .post(`user/integration`, {
      json: credentials,
      headers: secret ? { [INTERNAL_KEY_HEADER]: deriveInternalApiKey(secret) } : undefined,
    })
    .json<LoginOutput>();
}
