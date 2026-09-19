# frontend (`packages/frontend`) — Agent Rules

## Package manager

- This is part of the root pnpm monorepo. Run installs from root (`pnpm install`).
- Always use `pnpm` for installs, scripts, and lockfile updates (e.g. `pnpm --filter d-frontend ...`).
- Do NOT use `npm` or `yarn`. `package-lock.json` and `yarn.lock` are gitignored; only the root `pnpm-lock.yaml` is tracked.

## UI components (shadcn-managed)

- Do NOT create, edit, or delete files in `src/components/ui/` without explicit user confirmation.
- This folder is managed by shadcn. Before any change there, explain what changes are required and why, and ask for permission.
- Create custom components outside `ui/` (e.g. directly under `src/components/`) — those are freely editable.
- To add/update shadcn components, prefer the shadcn CLI (`pnpm dlx shadcn@latest ...`) over hand-editing.

## Styles (shadcn-managed CSS)

- NEVER edit `src/index.css` — it is shadcn-managed and will be overwritten by shadcn updates.
- If custom CSS is needed, create a NEW css file (e.g. `src/theme.css`) and import it in `src/main.tsx` AFTER `index.css` so it wins the cascade on equal specificity.
