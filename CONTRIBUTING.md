# Contributing

This guide covers how to set up the project and get changes merged. The coding standards themselves live in [AGENTS.md](./AGENTS.md): it is the single source of truth for humans and AI assistants alike, and AI tools read it automatically.

---

## Requirements

- Bun ≥ 1.4
- pnpm ≥ 12

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env` with your local values. Never commit it.

The host machine has many ports in use, so lyra uses random high ports: the server on `PORT` (39422) and Vite on 44790. Before starting anything locally, check the port is free with `ss -ltn`.

## Scripts

| Command          | What it does                                      |
| ---------------- | ------------------------------------------------- |
| `pnpm lint`      | Runs oxlint                                       |
| `pnpm format`    | Formats the code with Prettier                    |
| `pnpm typecheck` | Typechecks with tsc (no output)                   |
| `pnpm test`      | Runs the unit tests                               |
| `pnpm test:e2e`  | Runs the Playwright tests                         |
| `pnpm dev`       | Starts the server and the web app                 |
| `pnpm build`     | Builds the server (tsdown) and the web app (Vite) |

## Running in production

1. `pnpm install && pnpm build`. This produces `apps/server/dist/main.mjs` and `apps/web/dist`.
   Then install the Chromium that the Google sign-in browser uses, as the same user that runs the server (browsers live in that user's `~/.cache/ms-playwright`):
   `pnpm --filter @lyra/server exec playwright install --with-deps chromium-headless-shell`.
   `--with-deps` installs the system libraries and needs root on Debian or Ubuntu; without it, run `sudo pnpm --filter @lyra/server exec playwright install-deps chromium` once.
   On systems Playwright does not support yet (it warns and downloads a fallback build), install Google Chrome or Chromium from the system instead and set `BROWSER_EXECUTABLE` to its path.
2. Write a production env file outside the repository, based on `.env.example`:
   - `PUBLIC_URL`: the public HTTPS address (passkeys and email links depend on it).
   - `WEB_DIST`: absolute path to `apps/web/dist`, so one process serves the API and the app.
   - `TRUST_PROXY=true` only when every request comes through a reverse proxy or tunnel that sets `CF-Connecting-IP`; never when the port is reachable directly.
   - `SECRET_KEY`: keep it safe; losing it unlinks every Google account.
   - `REGISTRATION_ENABLED=false` once your accounts exist: sign-ups are refused and the app hides them.
3. Start the server with Bun from a directory without a `.env` (Bun would load it):
   `bun --env-file=/path/to/lyra.env /path/to/lyra/apps/server/dist/main.mjs`.
   Database migrations run on start.
4. Keep it running with a process manager. With pm2, launch `bun` itself (`"interpreter": "none"`): pm2's Bun wrapper uses `require()` and cannot load the server's top-level `await`.

---

## Workflow

1. **Create a branch** from the default branch:
   - `feature/<short-name>` for new functionality
   - `fix/<short-name>` for bug fixes
   - `chore/<short-name>` for maintenance
2. **Commit** following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add user search`
   - `fix(api): handle empty query`
   - `chore: update dependencies`
3. **Before opening a pull request**, make sure these pass:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm format`
4. **Open the pull request:**
   - Keep it small and focused on one purpose.
   - Explain what changed and why.
   - Link the related issue, if there is one.

---

## Working with AI assistants

AI assistants are welcome, with two conditions:

- **You are responsible for what you submit**, whoever wrote it. Review AI-generated code as carefully as your own and run the checks above.
- **Fix the rule, not just the code.** If an assistant keeps breaking a guideline, improve its wording or add the reason behind it in [AGENTS.md](./AGENTS.md), so the fix applies to every future session.
