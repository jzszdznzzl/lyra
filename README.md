<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/jzszdznzzl/lyra/main/assets/logo-dark.svg">
  <img alt="lyra" src="https://raw.githubusercontent.com/jzszdznzzl/lyra/main/assets/logo-light.svg" width="300">
</picture>

**Your YT Music library, in a player that does what YT Music doesn't.**
<br>
A self-hosted PWA with crossfade, an equalizer, synced lyrics, offline downloads and Spotify Connect–style control across your devices.

[![license](https://img.shields.io/badge/license-MIT-e0457b)](./LICENSE)
![bun](https://img.shields.io/badge/bun-%E2%89%A51.4-000000?logo=bun&logoColor=white)
![elysia](https://img.shields.io/badge/elysia-1.4-8b5cf6)
![react](https://img.shields.io/badge/react-19-149eca?logo=react&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-7-3178c6?logo=typescript&logoColor=white)
![zod](https://img.shields.io/badge/zod-4-3e67b1?logo=zod&logoColor=white)
![pwa](https://img.shields.io/badge/PWA-installable-5a0fc8?logo=pwa&logoColor=white)

**English** · [Español](./README.es.md)

</div>

---

> [!WARNING]
> **Lyra is an unofficial personal project.** It is not affiliated with, endorsed by or supported by Google, YouTube or YouTube Music. It talks to YT Music's internal, undocumented API the same way the official web app does, so **it can stop working at any time**, without notice, whenever Google changes that API. Using it may go against YouTube's Terms of Service, and you use it at your own risk. Lyra does not host, share or sell any content: it only plays what your own account can already access.

## Why lyra?

YT Music has a huge catalog, but the player around it is basic. Lyra signs in to your Google account and keeps your library, likes and playlists, then adds what is missing:

|                                      | YT Music (web)   | **lyra**                                                              |
| ------------------------------------ | ---------------- | --------------------------------------------------------------------- |
| Crossfade and fade in/out            | ❌               | ✅                                                                    |
| Equalizer                            | ❌               | ✅ 10 bands, presets and custom                                       |
| Synced lyrics                        | some songs       | ✅ from [LRCLIB](https://lrclib.net), YT Music's lyrics as a fallback |
| Offline downloads in the browser     | Premium app only | ✅ installable PWA                                                    |
| Control playback from another device | ❌               | ✅ Spotify Connect–style                                              |
| Shared links                         | YouTube links    | ✅ lyra links with title and cover previews                           |

## Features

- 🎵 **The whole catalog.** Search, home feed, explore, albums, artists, playlists and music videos.
- 📚 **Your library.** Liked songs, creating and editing playlists, and a queue you can reorder.
- 🎚️ **Better sound.** Fade in/out, crossfade, a 10-band equalizer with presets, and audio quality up to the best available.
- 🎤 **Lyrics.** Synced lyrics from LRCLIB that follow the song, YT Music's plain lyrics when there are none, and an immersive full-screen view.
- 📡 **Connect.** See where music is playing, move it to this device with "listen here", change the volume remotely and share one queue between devices.
- 📥 **Offline.** Download songs to the browser and play them without a connection.
- 🔐 **Accounts.** Email verification, sessions, passkeys and avatars. Google cookies are stored encrypted with AES-256-GCM.
- 🌍 **English and Spanish**, dark and light themes, and media controls on the lock screen.

## How it works

```
apps/server/      Bun + Elysia: API, YT Music client (youtubei.js), streaming and the Connect WebSocket hub
apps/web/         React 19 + Vite PWA
packages/shared/  Types, domain objects and zod schemas shared by both
e2e/              Playwright tests
```

- **Linking Google.** Choose between a **remote browser** (the server opens Chromium, streams it to your page and saves the session once you sign in to `music.youtube.com`) or **pasting the `Cookie` header** from your browser's DevTools. Cookies are checked with a real request before they are saved.
- **Streaming.** The server resolves the audio for each song and proxies it, so the browser plays it like any other file and the equalizer and crossfade work on it.
- **Storage.** One SQLite file (`bun:sqlite` + Drizzle) in `DATA_DIR`; migrations run on start.

## Getting started

Requirements:

- **Bun ≥ 1.4** and **pnpm ≥ 12**
- A Google account with YT Music
- An SMTP server for verification emails, or `MAIL_TRANSPORT=log` to print them to the console

```bash
pnpm install
cp .env.example .env
openssl rand -base64 32   # paste it into SECRET_KEY
pnpm dev
```

The server listens on `PORT` (39422) and the web app on `http://localhost:44790`. Create an account, then link Google from your profile.

Running in production (Chromium for the remote browser, env file, reverse proxy, process manager) is covered in [CONTRIBUTING.md](./CONTRIBUTING.md#running-in-production).

## Scripts

| Command          | What it does                                      |
| ---------------- | ------------------------------------------------- |
| `pnpm dev`       | Starts the server and the web app                 |
| `pnpm build`     | Builds the server (tsdown) and the web app (Vite) |
| `pnpm lint`      | Runs oxlint                                       |
| `pnpm typecheck` | Typechecks with tsc                               |
| `pnpm test`      | Runs the unit tests                               |
| `pnpm test:e2e`  | Runs the Playwright tests                         |

## Contributing

Setup, scripts and workflow are in [CONTRIBUTING.md](./CONTRIBUTING.md). The coding rules, for humans and AI assistants alike, are in [AGENTS.md](./AGENTS.md).

## Contact

me@jzszdznzzl.dev

## License

[MIT](./LICENSE) © José Daniel Cristaldo Vera
