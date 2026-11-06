# Skin Generator (`packages/skin-generator`)

Package `@globe-rtc/skin-generator`. Builds pixel-art avatar skins by layering
the character pieces of the **Modern Interiors** pack (LimeZu). It reproduces
what the "Character Generator 2.0" Unity tool does: pick or randomize parts,
get the composed character back as a PNG.

## What it does

- `randomizeSkin({ parts, current?, type?, seed? })` — rolls only the parts in
  `parts` (`body`, `eyes`, `outfit`, `hairstyle`, `accessory`) and keeps the
  rest from `current`. Equivalent to the tool's Randomize tab with its
  checkboxes.
- `renderSkin(selection, { includeSpritesheet? })` — layers the pieces
  (body → eyes → outfit → hairstyle → accessory) and returns PNG buffers.
- `generateSkin(options)` — both in one call: what a Randomize click does.
- A `seed` (number or string) makes the roll reproducible, so the API can send
  a seed instead of the whole selection. The result always includes the seed
  used.

## Output

- `preview`: the four standing poses (right, up, left, down) side by side,
  `4 * size` x `2 * size` px (128x64 for the default size 32).
- `spritesheet`, two modes:
  - `animations: ["idle", "walk"]` (what the API's `sheet=true` uses): a compact
    sheet with only those rows stacked top to bottom, 24 frames wide each
    (768x128 for idle + walk at size 32), no label tags. `animationLayout`
    describes it (frame size, directions, rows).
  - `includeSpritesheet: true`: the whole sheet. Adults are 56x20 frames, kids
    24x4; each frame is `size` wide, `size * 2` tall. **Careful:** the pack's
    `Body` image has the author's label tags ("idle", "walk", "sleep"...) and
    prop drawings (bed, cart, weapon effects) baked into it, so the whole sheet
    contains them to the right of the animations. Do not use it directly as a
    game sprite; use `animations`.

"Size 32" means the 32x32 variant of the pack (frames are 32x64), which is the
tool's "Size 32x32" option. 16 and 48 work too via the `size` option.

## Spritesheet rows

What every row of the spritesheet is (idle, walk, sleep, sit, phone, push cart, pick up, gift, lift, throw, hit,
punch, stab, gun, shoot, hurt), with pixel offsets and frame counts, lives in
[`packages/skin-generator/README.md`](../../packages/skin-generator/README.md). That README is the single source of
truth (Portuguese, user preference); keep it updated when a new animation is extracted. Only idle and walk are
extracted today; each is 24 frames, 6 per direction in the order right, up, left, down.

## Extracted animations (user decision: only these)

User chose the set: idle, walk, sit, throw (a paper ball later), punch, hurt. Verified frame by frame (numbered
crops of the real sheet, plus a pixel test that the left frames are mirrors of the right ones). Frames start at the
left edge of the pack's row; everything to the right (label tag, props such as the red square next to hurt) is cut.

| Name | Pack row | Directions (in this order) | Frames per direction | Frames |
|---|---|---|---|---|
| idle | 1 | right, up, left, down | 6 | 24 |
| walk | 2 | right, up, left, down | 6 | 24 |
| sit | 4 | right, left (side view only, no front/back) | 6 | 12 |
| throw | 12 | right, up, left, down | 14 | 56 |
| punch | 14 | right, up, left, down | 6 | 24 |
| hurt | 19 | right, up, left, down | 3 (white flash, red flash, white) | 12 |

Row 5 is a second sitting variation (not extracted). A sheet with all six is 1792x384 (about 110 KB PNG for one
skin); the sheet is as wide as the longest animation requested (throw = 56 frames). `animationLayout.animations[]`
carries `directions` and `framesPerDirection` per animation. Not extracted: sleep, phone, push cart, pick up,
gift, lift, stab, gun idle, grab gun, shoot.

## API endpoint (`apps/api`)

`GET /skin/generate` (module `application/skin`, controller
`presentation/controllers/skin`). **Requires a logged in user** (user decision: it must not be public; it is no
longer excluded from the JWT middleware in `app.module.ts`). It runs CPU work
per call, so a rate limit per user is still a good idea.

Query (all optional): `type=adult|kid`, `parts=outfit,hairstyle` (default: all
parts), `body|eyes|outfit|hairstyle|accessory=<piece id>` (kept when that part
is not rolled; `none` = no hairstyle/accessory), `format=image|json`,
`sheet=true` (spritesheet instead of the preview; `format=json` adds `layout`), `animations=idle,walk,sit,throw,punch,hurt`
(with `sheet=true`: which rows, top to bottom; default idle + walk = 768x128).

The client does **not** send a seed or a scale (user decision): the use case
rolls a fresh random 4-digit seed (1000-9999) per request and always renders
the preview at 1x (128x64; the front enlarges it, e.g. `image-rendering:
pixelated`). The seed is still returned (`X-Skin-Seed` header / `seed` field)
for debugging. Trade-off: 9000 possible seeds means at most 9000 distinct
skins per combination of `parts`, far fewer than the real piece combinations;
widen `SEED_MIN`/`SEED_MAX` in `generate-skin.use-case.ts` if variety matters.
To persist a player's skin, store the `selection` (piece ids), not the seed.

- `format=image` (default) returns the PNG; `X-Skin-Seed` and
  `X-Skin-Selection` response headers carry the seed and the selection.
- `format=json` returns `{ seed, selection, preview, spritesheet? }` with data
  URLs.
- Errors: 401 without login, 400 for unknown parts/pieces or bad values, 500 if the assets are not
  installed.

Try it logged in (cookie `meta-session`, e.g. from the browser), or from Swagger
(`/docs`) with a bearer token: `http://localhost:4000/skin/generate?parts=outfit,hairstyle`.

## Rules copied from the original tool

- Adult and kid are separate sets of pieces; changing the type re-rolls every
  part. Kids have no accessories.
- Pajama kid outfits (`Outfit_kid_6_pajama_frog`, `Outfit_kid_7_pajama_tiger`)
  have no hairstyle.
- Piece ids are the file name without `.png`.

## Assets (important)

The pieces are **never committed or served**. The Modern Interiors license allows using the art in projects (credit
LimeZu, limezu.itch.io) but forbids redistributing the asset. They live in `packages/skin-generator/private-assets/`,
which is in the package's own `.gitignore` (user decision: it is only used by this package, so it lives inside it). Rules:

- Do not put them in `apps/web/public`: everything under `public/` is served as a raw static file
  to every visitor (the whole pack could be downloaded), and a new `public/` folder is committed unless it is
  git-ignored. The game only needs the composed images, which the API returns.
- The API only returns composed images; the raw pieces never leave the server.
- Fill the folder with:

```bash
pnpm --filter @globe-rtc/skin-generator sync-assets -- --source "<pack>/moderninteriors-win/2_Characters/Character_Generator"
```

(`--sizes 16,32,48` for other variants, `--target <folder>` for another destination.) In production point
`SKIN_GENERATOR_ASSETS_DIR` at a mounted volume with the same layout (`<size>x<size>/<Folder>/<id>.png`); the pieces
must be provisioned on the server, they are not in the git repo.

Related convention already in the repo: the art the Phaser client must download (Modern Interiors tile sheets,
character sprites) lives in `apps/web/public/tiles` and `apps/web/public/sprites`, which `apps/web/.gitignore` excludes
from git (like `/tilesets`). The browser game still serves those files to players at runtime, which is inherent to a
client-side game; just keep them out of the repo. Skin pieces follow the stricter rule above because the client never
needs them.

## Notes

- Dependency is only `pngjs` (pure JS, no native build), unlike `bcrypt`.
- Tests use tiny synthetic pieces at size 16, so they do not need the art:
  `pnpm --filter @globe-rtc/skin-generator test`.
- `apps/api` consumes the package through its compiled `dist/` (like
  `@globe-rtc/env`). The package has a `prepare` script that runs `tsc`, so
  `pnpm install` (from WSL) should build it; if not, run
  `pnpm --filter @globe-rtc/skin-generator build`.
- Planned next: idle/walk animation extraction from the spritesheet.
