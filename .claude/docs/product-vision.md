# Product Vision

## Core idea (updated 2026-10-12)

Globe RTC is now aimed at a **Habbo Hotel-style** experience: each user
builds/decorates their own room, and can visit other users' rooms. The
game itself is the communication tool — proximity between avatars still
drives voice, video and chat within a room — but the room-ownership and
visiting model (not a single shared world/lobby) is now the core loop,
replacing the earlier "scrum poker" planning-tool framing entirely.
**Scrum/voting is explicitly NOT a goal** — all voting-scale, card,
story-point and round leftovers from the original scrum-poker clone are
being removed from both apps/web and apps/api.

Everyone shows up as an avatar in a shared tileset world, and how close
your avatar is to someone else's controls what you can hear and see from
them: walk up to someone and you start hearing/seeing them; walk away
and they fade out. Movement *is* the way you join or leave a
conversation — no separate step for it.

Everything runs in the browser, no install, no app — just open a link,
same as the room-join flow that already exists today.

## Previous idea (superseded)

Earlier framing described a single open "lobby" world without a
room-ownership/decoration concept. That's superseded by the Habbo-style
own-room + visit-other-rooms model above, though the proximity
voice/video/chat mechanics below still apply inside a room.

## Feature set

- **Proximity voice** — get close to someone, hear them; move away,
  stop hearing them.
- **Mute / unmute** — manual toggle, layered on top of proximity.
- **Webcam video** — video bubble near/above the avatar, visible to
  nearby players.
- **Screen share** — visible to nearby players — exact UI still open,
  see questions below.
- **Text chat** — already exists today as chat bubbles over the avatar.

## Why the current architecture already fits this

- **apps/game-server (Colyseus)** already tracks every player's `x`/`y`
  position per room in real time — this is exactly the data proximity
  voice needs to decide who should hear whom.
- **apps/web** already has proximity-adjacent UI: `NearbyPlayers`,
  chat bubbles over avatars, a ping indicator, an invisible mode. The
  building blocks for "who is near me" already exist on the frontend.
- **Missing piece**: a WebRTC layer for audio/video, with connections
  opened/closed (or volume adjusted) based on the proximity data Colyseus
  already has.

## Open questions (resolve as design progresses)

1. **Voice falloff** — hard cutoff at a fixed radius, or gradual volume
   based on distance (true spatial audio)?
2. **WebRTC topology** — peer-to-peer mesh (simple, but doesn't scale
   past a handful of simultaneous nearby connections) vs an SFU
   (mediasoup / LiveKit / Janus — scales better, more infra to run)?
   Depends on how many people we expect near each other at once.
3. **Screen share UX** — a bubble like webcam video, or a "shared
   object" in the world (like a TV/projector) that people walk up to in
   order to view it?
4. **Text chat scope** — stays always-visible like today, or also
   becomes proximity-gated to match voice/video for consistency?
5. **Mute/deafen visibility** — purely local UI state, or synced so
   other players see a muted icon over your avatar?
6. **Private zones** — any concept of a "meeting room" area where
   everyone inside hears each other regardless of exact distance,
   separate from open-world proximity rules?

## Status

This is the north-star vision as of the conversation that introduced it.
Update this file whenever the user refines the idea, answers one of the
open questions above, or introduces new constraints — this is meant to
be the single place a future session reads to understand *what we are
actually building and why*, before touching code.
