# Agent: Environment Setup For A New Worktree

You are working in a new worktree. `packages/backend/.env` and
`packages/frontend/.env` are gitignored, so they do not exist here. Before
running or testing the app, create them by following these steps exactly.

## Do this

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
   `OPENROUTER_API_KEY` values from it into `packages/backend/.env`.

4. In `packages/backend/.env` set `PORT` to the port from step 1,
   `BETTER_AUTH_URL` to `http://localhost:<port>`, and `FRONTEND_URL` to
   `http://localhost:5173`. Leave the rest as copied from the example.

5. In `packages/frontend/.env` set `VITE_API_URL` to `http://localhost:<port>`
   (same port), overwriting the tunnel value from the example.

All URLs must be `localhost` in a worktree. Never use the cloudflared tunnel
hostnames (e.g. `*.minepicoin.com`).

## Or run this

From the new worktree's repo root, this performs steps 1–5 in one shot:

```powershell
$keys = "C:\home\kiki\keys\env-variables.txt"

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

Write-Host "Backend :$port; frontend points at it (localhost only)."
```

## Constraints

- Never commit `.env`; it is gitignored.
- Install deps from the repo root with `pnpm install`, never inside `packages/*`.
- Use `localhost` URLs in a worktree. Do not use the cloudflared tunnel
  hostnames from `docs/cloudflared-tunnel.md`; those are for the main checkout
  only.
