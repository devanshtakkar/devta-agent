# Repo layout

This directory (`devta/`) is a container repo. It is NOT a monorepo:

- `d-frontend/` — own independent git repo (Vite + React + PWA)
- `d-backend/` — own independent git repo
- Root tracks only shared container-level files (e.g. `App+Icon+*`, this file).

## Rules

1. Never `git add d-frontend` / `git add d-backend` (or `git add -A` / `git commit -a`
   from root without checking `git status` first) — that would record them as
   gitlinks (submodule-like entries) in the root repo.
2. If that ever happens by mistake, undo with:
   `git rm --cached d-frontend` (or `d-backend`)
   This only un-stages the gitlink; it does not touch any files.
3. Commit frontend/backend work inside their own repos, not from root.
