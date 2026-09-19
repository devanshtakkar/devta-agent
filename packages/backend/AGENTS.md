# backend (`packages/backend`) — Agent Rules

## Package manager

- This is part of the root pnpm monorepo. Run installs from root (`pnpm install`).
- Always use `pnpm` for installs, scripts, and lockfile updates (e.g. `pnpm --filter d-backend ...`).
- Do NOT use `npm` or `yarn`. `package-lock.json` and `yarn.lock` are gitignored; only the root `pnpm-lock.yaml` is tracked.
- Never commit `.env` (gitignored). See `.env.example` for required vars.
