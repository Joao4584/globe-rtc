# Dev Workflow

## CURRENT SETUP (since 2026-11-03): services run on Windows, only Docker in WSL

Decision (user): run web/api/game-server **natively on Windows** and keep only Postgres
(Docker) in WSL. Reason: the repo lives on `C:` and the file watchers (Next, Nest, tsx)
inside WSL do not see edits made from Windows, so changes needed manual restarts. On
Windows the watchers work (verified: Next recompiled in ~0.2s, Nest in ~1s) and startup is
far faster (Next ready in 2s vs 17s; API compile seconds vs ~3 min).

- Start each service in its own terminal tab (PowerShell blocks `pnpm.ps1`, so call
  `pnpm.cmd`):
  - `apps/api`: `pnpm.cmd dev`  (http://localhost:4000)
  - `apps/game-server`: `pnpm.cmd dev`  (ws://localhost:2567)
  - `apps/web`: `pnpm.cmd dev`  (http://localhost:3000)
- Database: `sudo docker compose up` in WSL as before (reachable at `localhost:5432`).
- Migrations: `pnpm.cmd typeorm migration:run` from `apps/api`.
- `node_modules` must be installed from **Windows** (`CI=true pnpm install` in Git Bash or
  `pnpm.cmd install`), never from WSL: bcrypt and other native addons are per-platform.
  Switching back to WSL would need a reinstall from WSL.
- If `node_modules` was created by WSL, Windows cannot delete it (`EPERM` on the Linux
  symlinks): remove the `node_modules` folders from WSL (`rm -rf`) first, then run the
  install from Windows.
- After changing `packages/env/index.ts`, rebuild it: `cd packages/env && npx tsc`.
- Windows Node is 22.x (the old WSL setup used nvm Node 24); everything runs on 22.

The sections below describe the **old WSL-based setup** (kept for reference and for the
Docker tab, which is still valid).

---

This project used to be developed from **WSL**, not plain Windows PowerShell.

## Getting Phaser.js context/help (no paid tools needed)

The user asked about `npx @phaserjs/game-agent` (official Phaser tool to
connect a coding agent to Phaser's hosted service) — it requires signing
into a Phaser account and a paid credit balance, no free tier. Decision:
**don't use it**. Everything needed is already free and local:

- `apps/web/node_modules/phaser` has the full `.d.ts` type definitions —
  read these directly for exact current API/signatures instead of
  guessing or relying on possibly-outdated training knowledge.
- `phaser.io/examples` and `docs.phaser.io` — fetch these (WebFetch) on
  demand when implementing an unfamiliar pattern (tweens, physics,
  input, etc.).

This covers Phaser-specific implementation work in this repo (e.g. the
`apps/web/src/modules/shared/config/phaser-js/` and
`apps/web/src/modules/room/scenes/` code) without any subscription.

## Why WSL

- Windows PowerShell on this machine has script execution disabled
  (`PSSecurityException` when running `pnpm.ps1` / `pnpm run dev`).
- WSL avoids this restriction entirely and is the environment the user
  actually develops in day to day.
- The repo lives on the Windows filesystem and is reached from WSL at
  `/mnt/c/Users/<user>/Documents/Joao4584/Projetos/globe-rtc`.

## Standard startup: two terminal tabs

Every dev session starts the same way, in two separate terminal tabs:

**Tab 1 — app services (web, api, game-server)**
```bash
wsl
cd /mnt/c/Users/<user>/Documents/Joao4584/Projetos/globe-rtc   # if not already there
pnpm dev
```
This runs `turbo run dev` across the monorepo and starts:
- `web` on `http://localhost:3000` (Next.js + Turbopack)
- `api` on `http://localhost:4000` (NestJS, Swagger at `/docs`)
- `game-server` on `ws://localhost:2567` (Colyseus)

**Tab 2 — database**
```bash
wsl
cd /mnt/c/Users/<user>/Documents/Joao4584/Projetos/globe-rtc   # if not already there
sudo docker compose up
```
This starts the local Postgres instance the API depends on
(`DB_HOST=localhost`, `DB_PORT=5432`, see root `.env`).

Keep both tabs open and visible while developing — Tab 1 shows the
Turbo/Next/Nest/Colyseus logs, Tab 2 shows the Postgres container logs.
Do not try to run `docker` or `docker compose` directly from Windows —
the Docker CLI is not on PATH there in this setup; it only works from
inside WSL.

## Native modules: always install from WSL

`node_modules` lives on the Windows-mounted filesystem
(`/mnt/c/...`) and is shared between Windows and WSL, but native
addons (e.g. `bcrypt` in `apps/api`) are platform-specific binaries.
Running `pnpm install` from Windows (PowerShell/Git Bash) builds them
for Windows; running the app afterward from WSL then crashes with
`Error: .../bcrypt_lib.node: invalid ELF header { code:
'ERR_DLOPEN_FAILED' }` — Linux/WSL can't load a Windows-built `.node`
file. **Always run `pnpm install` (or anything that triggers a native
build) from inside WSL**, never from a Windows shell. If this happens
anyway, fix it from WSL with `pnpm rebuild bcrypt` (or a full
reinstall) and restart `pnpm dev`.

## Next/Turbopack dev server sometimes stops watching a file

On this machine (repo on `/mnt/c`, DrvFS under WSL2), the `next dev
--turbopack` file watcher can silently stop picking up edits to a
specific file — saving changes has zero effect, even across multiple
edits and even after a hard browser refresh, because the dev server
never recompiles that module at all (confirmed by comparing the source
file's mtime against the compiled chunk in `apps/web/.next/static/chunks/`
— the chunk stayed older and didn't contain the new code). This seems
related to the same inotify-over-DrvFS unreliability noted above for
native modules, just affecting the Turbopack watcher instead of
`pnpm install`. Symptom: you change a constant/value and it visibly has
zero effect in the running app no matter how many times you refresh.
Fix: fully stop and restart `pnpm dev` (not just save-and-refresh) to
force a clean recompile. Phaser/Colyseus game objects are also only
laid out once when created (e.g. a `NameLabel`'s `layout()` only reruns
when its text changes) — so a full page reload is also needed to
recreate those objects even when the underlying code *did* recompile.

## Fresh Postgres volume: run migrations

`synchronize: false` in `apps/api/src/shared/typeorm/typeorm.module.ts` —
TypeORM never auto-creates tables. After a fresh `docker compose up`
(new/empty `postgres_data` volume, e.g. first run or after a `docker
compose down -v`), the database has no tables at all, which surfaces as
`relation "users" does not exist` (or similar) as soon as the API makes
its first query, not as a startup error. Fix: from `apps/api`, run
```bash
pnpm typeorm migration:run
```
This applies everything under `apps/api/src/infrastructure/migrations/`.

## Port 5432 conflicts with other local Postgres containers

This machine also runs unrelated Docker Postgres containers for other
projects (e.g. `postgres_expense`) that bind host port 5432. Since
globe-rtc's `docker-compose.yml` also maps `5432:5432`, `sudo docker
compose up` here fails with `port is already allocated` if one of those
is already running — even after `docker compose down`/`up` cycles on
*this* project, since the real occupant is the other container, not
`postgres_db`. Diagnose with `docker ps -a --format '{{.Names}}\t{{.Ports}}'
| grep 5432` to find the culprit. User's preferred fix: stop the other
container (`sudo docker stop <name>`) rather than remapping globe-rtc's
port.

## New API files need an API restart

`nest start --watch` on `/mnt/c` does not notice new/changed files made from Windows
either. After adding API modules/entities: run the migration from WSL
(`cd apps/api && pnpm typeorm migration:run`) and restart the API (kill the Nest
processes, then `wsl --cd .../apps/api -- bash -ic "pnpm dev"` in a terminal tab).
First compile after a restart is slow (minutes) on this disk.

## Root `pnpm dev` script

Root `dev` is just `turbo run dev`. It used to be `husky run pre-dev && turbo
run dev`, but the repo uses husky 8 (no `run` command, only v9 has it) and
there is no `.husky/pre-dev` hook, so it only printed husky's usage text.
Turbo shows a TUI: pick `api#dev` / `web#dev` / `game-server#dev` with ↑/↓ to
see each service's logs.

## Node version: use the interactive WSL shell (nvm Node 24)

WSL has two Nodes: system `/usr/bin/node` is **v18** (non-interactive shells),
and nvm gives **v24** (interactive shells, i.e. where the user runs `wsl` then
`pnpm dev`). `apps/api` needs the newer one: `chalk@5` is ESM-only and the
API's compiled CommonJS `require("chalk")` crashes on Node 18 with
`ERR_REQUIRE_ESM`, so the API never opens port 4000 (and `nest start --watch`
just sits there with no clear error). When the assistant starts the app from the
Terminal tool, run it through an interactive shell so nvm loads:
`wsl --cd /mnt/c/.../globe-rtc -- bash -ic "pnpm dev"` (plain `wsl -- pnpm dev`
and `bash -lc` both end up on Node 18).

## Assistant notes (for future sessions)

- `sudo docker compose up` asks for the WSL sudo password, which the assistant
  can't type: the user must enter it in the database tab themselves.

- When the user asks to "start" or "run" the project, open two terminal
  tabs in the app's Terminal panel and hand the user (or run, if the
  terminal tooling allows typing into it) the two commands above — do not
  invent a different startup sequence.
- `packages/env` must have a built `dist/` (via `tsc`) or nothing that
  imports `@globe-rtc/env` at runtime will resolve, even though
  `tsconfig` path aliases make it compile fine. Build it once after a
  fresh clone/copy: `cd packages/env && npx tsc`. Rebuild it again whenever
  `packages/env/index.ts` changes (the apps load the compiled `dist/`, not the
  source). It finds the root `.env` by walking up to `pnpm-workspace.yaml`, so
  it works from both `index.ts` and `dist/index.js` (a fixed `../..` path broke
  the compiled one with "GITHUB_CLIENT_ID Required").
- Ports already in use by an existing `pnpm dev` (e.g. surfaced via
  `wslrelay.exe` holding the port on the Windows side under WSL2) mean a
  dev server is already running — reuse/inspect it instead of starting a
  second copy.
