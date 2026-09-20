# Cloudflared Tunnel

Expose the local dev servers to the internet via a Cloudflare tunnel.

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Prerequisites

- `cloudflared` must be installed and on your `PATH`.
- You must be logged in to Cloudflare (`cloudflared tunnel login`).
- The zone (e.g. `minepicoin.com`) must be added to your Cloudflare account.

## First-time setup (run once per service)

### 1. Create the tunnel

```powershell
cloudflared tunnel create dev-win-5173
```

This writes credentials to `C:\Users\<you>\.cloudflared\<tunnel-id>.json`.
Keep this file secret.

### 2. Attach your hostname to it

```powershell
cloudflared tunnel route dns dev-win-5173 dev-win-5173.minepicoin.com
```

This adds a CNAME so the hostname routes to the tunnel.

### 3. Run it pointing at your local app

Keep this terminal open while developing.

```powershell
cloudflared tunnel run --url http://localhost:5173 dev-win-5173
```

For the backend, create a second tunnel (`dev-win-5000`) and point it at port `5000`:

```powershell
cloudflared tunnel create dev-win-5000
cloudflared tunnel route dns dev-win-5000 dev-win-5000.minepicoin.com
cloudflared tunnel run --url http://localhost:5000 dev-win-5000
```

## Subsequent runs

After the tunnel exists, skip the create/route steps and just run it:

```powershell
# frontend (5173)
cloudflared tunnel run --url http://localhost:5173 dev-win-5173

# backend (5000)
cloudflared tunnel run --url http://localhost:5000 dev-win-5000
```

Or from the repo root, run both at once:

```powershell
pnpm tunnel
```

> Note: always pass `--url` unless the tunnel has ingress rules set in a config
> file. Without it cloudflared has nothing to forward to and returns `503`.
