# Project Overview

Globe RTC is a real-time multiplayer **lobby**: people create or join a
room and hang out together in a 2D tileset world (Phaser), with avatars,
movement, chat and presence.

The actual product direction — a 2D multiplayer world where proximity
between avatars drives voice, video and chat — is detailed in
[product-vision.md](./product-vision.md). Read that file for *why* the
project exists and where it's headed; this file stays focused on the
current technical state.

## Origin

This monorepo started as a clone of a personal "scrum poker" project
(planning-poker: rooms, voting cards, story points, rounds). That
project already had rooms, participants, auth and a Colyseus-backed 2D
avatar world underneath the poker layer. The poker-specific domain
(voting/cards/story-points/rounds, the `question`/`vote` tables, the
planning UI panel) was fully removed; the room/lobby/auth/world
infrastructure was kept and rebranded from `scrum-poker` to `globe-rtc`.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **apps/web**: Next.js 15 (App Router), React 19, Tailwind, Radix UI,
  React Query, NextAuth, Phaser (the 2D world)
- **apps/api**: NestJS 10 + Fastify, TypeORM/Postgres, Swagger
- **apps/game-server**: Colyseus (real-time position/movement/chat sync
  per room)
- **packages/env**: shared env schema (dotenv + zod), consumed as
  `@globe-rtc/env`
- **packages/skin-generator**: builds avatar skins (PNG) by randomizing and
  layering Modern Interiors pieces, consumed as `@globe-rtc/skin-generator`
  — see [skin-generator.md](./skin-generator.md)

## Status

This file will grow as the project's actual game/world direction gets
defined. Treat it as living documentation, not a finished spec — update
it whenever the user describes a new idea, preference, or direction for
the project so future sessions don't have to rediscover it.
