# Auth / social login (Google + GitHub)

Flow: login button -> NextAuth (`apps/web/src/app/api/auth/[...nextauth]/route.ts`)
-> `jwt` callback calls `POST /user/integration` on the API (server-only, see
[internal-routes.md](./internal-routes.md)) -> API returns a 24h JWT -> web sets
the `meta-session` cookie.

## One account per email (provider linking)

`users.email` is unique, so the same person signing in with GitHub and then
Google (or the reverse) must end up in the same account. `LoadUserIntegrationUseCase`:

1. finds the user by `github_id` / `google_id`;
2. otherwise finds by email and **links** the new provider id to that user, but
   only if the web sent `email_verified: true` (otherwise 409, because linking
   by an unverified email would let anyone take over an account);
3. a user already linked to a *different* id of the same provider gets 409.

`email_verified` comes from Google's `profile.email_verified`; for GitHub the
web asks `GET /user/emails` with the OAuth token and uses the primary verified
email (this also covers users with a private profile email).

## Failures are visible

If the API call fails, the `jwt` callback throws and NextAuth sends the user to
`/auth?error=...`, where the login form shows a message. Before this, the error
was swallowed and the user silently landed back on the login page. The real
reason is logged by the web server as `[auth] integration failed: ...`.

## Dev notes

- The first click on a provider can take ~15s on a cold dev server (Turbopack
  compiles `/api/auth/*` on demand). Not a bug.
- Do not test the success path with a fake provider id against a real account:
  it would link that fake id and block the real login with a 409.
