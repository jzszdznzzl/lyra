# Lyra

Personal music player on top of YT Music, installable as a PWA. Lyra signs in to your Google account and talks to YT Music's internal API the way the official web app does, then adds what YT Music lacks: crossfade, an equalizer, offline downloads and Spotify Connect–style control of playback across your devices.

> For personal use only. It is not distributed and is not affiliated with Google or YouTube.

## Features

- Search, home feed, albums, artists, playlists and music videos
- Liked songs, creating and editing playlists, queue management
- Fade in/out, crossfade, 10-band equalizer, selectable audio quality up to the maximum available
- Connect: see where music is playing, "listen here", remote volume, shared queue
- Offline downloads
- Accounts with email verification, sessions, passkeys and avatar
- English and Spanish, dark and light themes

## Layout

```
apps/server/      Bun + Elysia API and WebSocket hub
apps/web/         React + Vite PWA
packages/shared/  Types and schemas shared by both
e2e/              Playwright tests
docs/             Plan and UI mockups
```

## Getting started

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and scripts, and [AGENTS.md](./AGENTS.md) for the coding standards.

## Contact

me@jzszdznzzl.dev
