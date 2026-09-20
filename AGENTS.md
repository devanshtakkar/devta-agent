# Repo layout

This directory (`devta/`) is a pnpm monorepo (single git repo, single `pnpm-lock.yaml` at root):

- `packages/frontend/` — Vite + React + PWA (package name `d-frontend`)
- `packages/backend/` — Express + TypeScript API (package name `d-backend`)
- Root tracks shared files (`pnpm-workspace.yaml`, `package.json`, this file, `App+Icon+*`).

Run scripts from root with filters, e.g. `pnpm --filter d-frontend dev`, `pnpm -r build`.
Installs always run at root (`pnpm install`); do NOT run `pnpm install` inside `packages/*`.

## Devta — What this app is

Devta is a personal wingman PWA (mobile-only) for dating confidence:
- Starts at the first lifecycle stage: initiating a polite conversation in
  public/social scenarios (cafe, restaurant, street, party, etc.).
- Uses AI to brainstorm 4–5 context-aware conversation starters to choose from,
  with branch-out follow-ups for how the chat could proceed.
- Later stages: track connections and interaction history, and get AI help with
  respectful next steps as dating progresses toward genuine, consensual relationships.
- Architecture: `packages/frontend/` (Vite + React + PWA) talks to `packages/backend/`
  (Express + TypeScript + MongoDB + Vercel AI SDK via OpenRouter).
- All coaching advice must be respectful, consent-first, women psychology backed to stir up romantic feelings in the women for me, bending the rules slightly in my favour as long as they don't make me creep but still let me have succesfully dating life by not letting me get stuck in friendzone or as a "nice guy". Always include a graceful-exit option for me. The GOAL is to have a relationship and marriage eventaully.
- Core UX target: speed-to-action. The user is in a live moment and must get an
  actionable idea in seconds: one-tap quick actions, minimal typing/voice-first
  input, streaming + skimmable responses (opener line first, short why, exact
  next move), big touch targets, offline-tolerant PWA shell.

## Rules

1. Never `git add packages/frontend` / `git add packages/backend` as gitlinks — they are plain
   directories in this monorepo (no nested `.git`). If `git status` ever shows them as a gitlink,
   a nested `.git` crept back in — delete it, do not commit the gitlink.
2. Commit all frontend/backend work from root in this repo (branch `main`, remote `devta-agent`).
3. When testing the app, use the login credentials in `AGENTS.local.md` (gitignored, never
   commit it). If those credentials do not work, ask the user for updated ones — do not guess
   or create a new account.
