import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

// This file runs from `packages/env/index.ts` (source) and from `packages/env/dist/index.js` (compiled),
// which are at different depths, so a fixed "../.." does not work for both. Walk up to the monorepo root
// (the folder with pnpm-workspace.yaml) and use its .env.
function findRootEnvPath(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return resolve(dir, ".env");
    dir = resolve(dir, "..");
  }
  return resolve(__dirname, "..", "..", ".env");
}

config({ path: findRootEnvPath() });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT_WEB: z.coerce.number().default(3000),
  PORT_NEST: z.coerce.number().default(4000),
  NEXTAUTH_DEBUG: z.coerce.boolean().default(false),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  DB_HOST: z.string().default("0.0.0.0"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("password"),
  DB_DATABASE: z.string().default("nestdb"),
  DB_TIMEZONE: z.string().default("America/Sao_Paulo"),
  UPLOAD_STORAGE_PROVIDER: z
    .enum(["file-system", "s3"])
    .default("file-system"),
  // Used by NextAuth, and (through a derived key, see internal-key.ts) to prove to the API that a
  // request comes from our own Next.js server. Required in production.
  NEXTAUTH_SECRET: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(32).optional()),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production" && !data.NEXTAUTH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["NEXTAUTH_SECRET"],
      message: "NEXTAUTH_SECRET (min 32 chars) is required in production",
    });
  }
});

export { deriveInternalApiKey, INTERNAL_KEY_HEADER } from "./internal-key";

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
