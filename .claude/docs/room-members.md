# Rooms: roles, settings and presence

## Roles (`room_participant.role`)

- `owner` is `room.owner_id` (not stored in `room_participant`).
- `admin` and `member` are stored in `room_participant.role`; `visitor` is the
  default for anyone who merely entered the room (`/participants/join`).
  `is_admin` is kept in sync with `role = 'admin'`.
- Owner and admins can edit the room and add/remove members; only the owner can
  promote/demote admins. Members can see the member list. Visitors see nothing.
- Only **accepted friends** of the person adding can be added (direct add, there is
  no invite-accept flow yet). Removing a member sets the role back to `visitor`
  (the row is kept so the room stays in the user's list).
- Owner, admins and members skip the password of a private room: `POST
  /room/:id/verify-password` issues the access token for them (the room page sends
  a placeholder password; the API ignores it for those roles).

## API (apps/api, `RoomModule`)

- `PATCH /room/:id` (owner/admin): name, description, `public`, `password`
  (required when the room becomes private; cleared when it becomes public).
- `GET/POST /room/:id/members`, `PATCH|DELETE /room/:id/members/:user_public_id`.
- `GET /room/:id` returns `my_role` and `can_edit` besides `is_owner`.
- Migration `AddRoomParticipantRole1772100000000`.

## Who is online

- The game-server exposes `GET /rooms/:roomPublicId/online` (`{ count, players }`,
  invisible/ghost players hidden). The web polls it every 8s (`useRoomOnline`).
- Shown in the room details dialog and in the "Manage room" dialog (green dot per member).

## UI

- `ManageRoomDialog` (modules/rooms/components/manage-room): tabs Members / Settings.
  Opened from the room details dialog and from a "Manage room" button inside the room.
- Not done yet (user chose identity-only customization for now): map/theme and
  furniture decoration, Habbo-style.
