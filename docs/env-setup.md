# Agent: Environment Setup For A New Worktree

You are working in a new worktree. `packages/backend/.env` and
`packages/frontend/.env` are gitignored, so they do not exist here, and
`node_modules` is not shared between worktrees. Before running or testing the
app, follow these steps exactly.

All URLs in a worktree must be `localhost`. Never use the cloudflared tunnel
hostnames (e.g. `*.minepicoin.com`).

## Do this

0. Install dependencies from the worktree root (never inside `packages/*`):

   ```powershell
   pnpm install
   ```

1. Find a free backend port. Start at `5000`; if it is in use, bump by one and
   keep checking until free.

   ```powershell
   $port = 5000
   while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { $port++ }
   $port
   ```

2. Copy both example files to `.env`:

   ```powershell
   Copy-Item packages\backend\.env.example  packages\backend\.env  -Force
   Copy-Item packages\frontend\.env.example packages\frontend\.env -Force
   ```

3. Read `C:\home\kiki\keys\env-variables.txt` and copy the `MONGODB_URI` and
   `OPENROUTER_API_KEY` values from it into `packages/backend/.env`. If the
   file does not exist, ask the user for these two values.

4. In `packages/backend/.env` set `PORT` to the port from step 1 and
   `BETTER_AUTH_URL` to `http://localhost:<port>`.

5. In `packages/frontend/.env` set `VITE_API_URL` to `http://localhost:<port>`
   (same backend port), overwriting the tunnel value from the example.

6. Start the frontend dev server and **read the port it prints** — Vite
   auto-bumps `5173` → `5174` → … when the port is busy:

   ```powershell
   pnpm dev:frontend
   ```

   ```text
   ➜  Local:   http://localhost:5174/
   ```

   Set `FRONTEND_URL` in `packages/backend/.env` to that exact printed URL
   (`http://localhost:5174` in the example). This value drives Express CORS and
   better-auth `trustedOrigins`, so it must match the frontend origin.

7. Start the backend *after* the frontend, then verify:

   ```powershell
   pnpm dev:backend
   ```

   - `GET http://localhost:<port>/health` returns `{"ok":true}`.
   - Sign in with the credentials in `AGENTS.local.md`.

## Or run this

From the new worktree's repo root, this performs steps 0–5 in one shot. The
frontend port is not known until Vite runs, so it sets `FRONTEND_URL` to
`http://localhost:5173` as a default — you MUST still do step 6 and overwrite it
with the port Vite actually prints before starting the backend.

```powershell
$keys = "C:\home\kiki\keys\env-variables.txt"

pnpm install

$port = 5000
while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { $port++ }

Copy-Item packages\backend\.env.example  packages\backend\.env  -Force
Copy-Item packages\frontend\.env.example packages\frontend\.env -Force

$mongo = (Select-String -Path $keys -Pattern '^MONGODB_URI=').Line
$orKey = (Select-String -Path $keys -Pattern '^OPENROUTER_API_KEY=').Line

$backend = Get-Content packages\backend\.env
$backend = $backend -replace '^PORT=.*',              "PORT=$port"
$backend = $backend -replace '^FRONTEND_URL=.*',      "FRONTEND_URL=`"http://localhost:5173`""
$backend = $backend -replace '^BETTER_AUTH_URL=.*',   "BETTER_AUTH_URL=`"http://localhost:$port`""
$backend = $backend -replace '^MONGODB_URI=.*',       $mongo
$backend = $backend -replace '^OPENROUTER_API_KEY=.*', $orKey
Set-Content packages\backend\.env $backend

"VITE_API_URL=`"http://localhost:$port`"" | Set-Content packages\frontend\.env

Write-Host "Backend :$port. Now run pnpm dev:frontend, read the printed port, and set FRONTEND_URL in packages\backend\.env to match before starting the backend."
```

## Constraints

- Never commit `.env`; it is gitignored.
- Install deps from the repo root with `pnpm install`, never inside `packages/*`.
- `FRONTEND_URL` must equal the frontend origin Vite actually serves. If Vite
  bumped to `5174`, use `http://localhost:5174`, not `5173`.
- Start the backend *after* the frontend so CORS / auth origins are correct.
- Do not use the cloudflared tunnel hostnames from `docs/cloudflared-tunnel.md`
  in a worktree; those are for the main checkout only.
