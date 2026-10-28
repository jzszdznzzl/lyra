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

## Deployment

Lyra runs on the host PC and is published at `https://lyra.jzszdznzzl.dev` through a named Cloudflare tunnel. Two systemd user services keep it up (the user has lingering enabled, so they start at boot):

| Service               | What it runs                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `lyra.service`        | `apps/server/dist/main.mjs`, serving the API and `apps/web/dist`    |
| `lyra-tunnel.service` | `cloudflared tunnel run lyra` (config in `~/.cloudflared/lyra.yml`) |

Production settings live in `~/.config/lyra/lyra.env` (not in the repo) and data in `~/.local/share/lyra`. `TRUST_PROXY=true` is set there because every request arrives through the tunnel; never set it when the port is reachable directly.

After changing code, run `pnpm deploy:local` to rebuild and restart the server.

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
