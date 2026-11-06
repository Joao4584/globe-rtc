# Social: usernames and friends panel

## Username (`users.username`)

- Unique, lowercase, `a-z 0-9 _`, 3-30 chars. Generated when the account is
  created from the **start of the email (before the `@`)**: accents removed,
  `+tag` dropped, other characters become `_`. On collision: `_1`, `_2`, ... (random
  suffix after 50 tries). Logic in `apps/api/src/shared/username/username.ts`,
  used by `UserTypeOrmRepository.create()`.
- Migration `AddUserUsername1772000000000` adds the column and backfills existing
  users (oldest first gets the clean name). Run it from `apps/api` in WSL:
  `pnpm typeorm migration:run` (see dev-workflow.md; use an interactive shell for Node 24).
- The username is NOT updated when the email changes. There is no "change
  username" feature yet (idea for later).
- Friend search (`GET /user/search?name=`) matches **name or username** (a leading
  `@` is ignored, exact username first). It no longer matches or returns **email**:
  emails of other users are private. The friends list returns `username` instead of `email`.
- `GET /user/me` and the public profile also return `username`.

## Friends UI

- The "Social" sidebar tab and `/app/friends` page were removed. The friends button
  lives in the top header, right next to the profile picture (`FriendsHeaderButton` in
  `modules/friends/components/friends-header/`, mounted in the workspace `Header`).
  It is only the icon (no border) with a small red badge for received requests
  waiting. Clicking opens a mini card that drops **down** under the header (380px wide,
  height min(560px, 70vh)) with the friends list, requests and "add friend". Clicking
  outside or pressing Esc closes it (clicks inside dialogs/menus opened from the card
  don't count). It used to be a floating bottom-right button; the badge was clipped
  there by overflow-hidden, so the user moved it to the header.
  User preference: a mini card, not a full-height sidebar.
- The user menu (click on the name in the top bar) starts with a card: name,
  `@username` and a button that copies `@username`.
