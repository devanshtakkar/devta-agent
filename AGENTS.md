# Repo layout

This directory (`devta/`) is a container repo. It is NOT a monorepo:

- `d-frontend/` — own independent git repo (Vite + React + PWA)
- `d-backend/` — own independent git repo
- Root tracks only shared container-level files (e.g. `App+Icon+*`, this file).

## Devta — What this app is

Devta is a personal wingman PWA (mobile-only) for dating confidence:
- Starts at the first lifecycle stage: initiating a polite conversation in
  public/social scenarios (cafe, restaurant, street, party, etc.).
- Uses AI to brainstorm 4–5 context-aware conversation starters to choose from,
  with branch-out follow-ups for how the chat could proceed.
- Later stages: track connections and interaction history, and get AI help with
  respectful next steps as dating progresses toward genuine, consensual relationships.
- Architecture: `d-frontend/` (Vite + React + PWA) talks to `d-backend/`
  (Express + TypeScript + MongoDB + Vercel AI SDK via OpenRouter).
- All coaching advice must be respectful, consent-first: no manipulation,
  no explicit or objectifying content, always include a graceful-exit option.
- Core UX target: speed-to-action. The user is in a live moment and must get an
  actionable idea in seconds: one-tap quick actions, minimal typing/voice-first
  input, streaming + skimmable responses (opener line first, short why, exact
  next move), big touch targets, offline-tolerant PWA shell.

## Rules

1. Never `git add d-frontend` / `git add d-backend` (or `git add -A` / `git commit -a`
   from root without checking `git status` first) — that would record them as
   gitlinks (submodule-like entries) in the root repo.
2. If that ever happens by mistake, undo with:
   `git rm --cached d-frontend` (or `d-backend`)
   This only un-stages the gitlink; it does not touch any files.
3. Commit frontend/backend work inside their own repos, not from root.
