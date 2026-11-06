# Internal-only API routes

Some API routes must be callable only by our own servers (the Next.js server),
never by someone on the internet. Today that is `POST /user/integration`: it
issues a JWT from whatever `type`/`id`/`email` the body says, without checking
the provider, so anyone who can reach it can create accounts or take over an
account whose GitHub/Google id they know.

## Why the usual "where does it come from" checks are not enough

- **CORS** is a rule enforced by browsers. curl, scripts and other servers
  ignore it, so it never stops a direct request to the API. (It is also
  `origin: '*'` here, and the site's own browser calls are same-origin through
  the `/backend` proxy, so CORS plays no role in this problem.)
- **`Origin` / `Host` / `Referer`** are plain headers; any non-browser client
  sets them to whatever it wants.
- **Client IP / "API only reachable from the Next server"**: the web app
  proxies `/backend/*` to the API (`rewrites()` in `apps/web/next.config.ts`).
  `https://<site>/backend/user/integration` reaches the API *from the Next
  server*, so a request from the internet passes any IP check.
- What works: proof that only the Next server can produce. The browser never
  receives it and the `/backend` proxy does not add it.

## How it works

- The proof is a key derived from `NEXTAUTH_SECRET`
  (`deriveInternalApiKey` in `packages/env/internal-key.ts`:
  `HMAC-SHA256(NEXTAUTH_SECRET, "globe-rtc:internal-api:v1")`, hex). No extra
  environment variable. The raw `NEXTAUTH_SECRET` is **never sent**: the HMAC is
  one-way, so a leaked key (logs, a proxy, a packet capture) cannot be used to
  forge NextAuth sessions. Sending the raw secret would have exactly that risk.
- `@InternalOnly()` (`apps/api/src/presentation/decorators/internal-only.decorator.ts`)
  applies `InternalOnlyGuard` (`.../guards/internal-only.guard.ts`) and
  documents the header in Swagger. Put it on any route or controller:
  `@Post() @InternalOnly()`. Today only `POST /user/integration` uses it.
- The guard compares the `x-internal-key` header with the derived key in
  constant time. Wrong key: `403`.
- Production (or any `NODE_ENV` other than `development`/`test`, including
  unset): the header is required. If `NEXTAUTH_SECRET` is missing the guard
  refuses everything, and `@globe-rtc/env` refuses to boot (the variable is
  required, min 32 chars, when `NODE_ENV=production`).
- Development/test: the header is optional, so Swagger, Bruno and curl keep
  working; if it is sent it must be correct.
- `apps/web/src/modules/auth/services/post-integration.ts` sends the header.
  It is server-only (called from the NextAuth `jwt` callback through a server
  action): the browser never calls it and never sees the key.
- The API needs `NEXTAUTH_SECRET` in its environment too (same value as the
  web app). Locally the shared root `.env` covers both; in production set it
  on both services.
- Changing `NEXTAUTH_SECRET` changes the key on both sides at once, so a
  rotation needs no extra step (it also logs users out, as always with NextAuth).

## Trying the production behavior locally

Print the derived key (it is not the secret) from the repo root:

```bash
node -e "require('./packages/env/node_modules/dotenv').config({path:'.env'});console.log(require('./packages/env/dist/internal-key').deriveInternalApiKey(process.env.NEXTAUTH_SECRET))"
```

Paste it into the `internalApiKey` variable of the Bruno `Local` environment
to send it. To see the 403 path, start the API with `NODE_ENV=production`
(needs the other production variables) and call without the header.

The Swagger "Login" button (`swagger.controller.ts` `login.js`) does not send
the header, so it only works in development.

If `packages/env` changed, rebuild it: `cd packages/env && npx tsc`
(`dist/` is not committed).

## Tests

`pnpm --filter api test` runs `internal-only.guard.spec.ts` (correct key,
missing, wrong, raw secret rejected, fail closed, unset `NODE_ENV` is strict,
open in development). The API's jest config maps the `@/` alias for this. The
guard imports `@globe-rtc/env/dist/internal-key` directly because the package
index validates the whole environment when imported.

## Not covered (possible follow-ups)

- Other routes with the same trust problem: none known; reuse the decorator
  when one appears.
- Swagger `/docs` is public, CORS is `origin: '*'` with credentials, and
  nothing rate-limits the API. Worth reviewing before production.
- The stronger fix for `/user/integration` is to verify the provider (send the
  GitHub access token / Google id token and let the API confirm the identity)
  instead of trusting `id` and `email`. The derived key only guarantees the
  caller is our Next server.
