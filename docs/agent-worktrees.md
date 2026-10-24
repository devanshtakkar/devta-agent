# Developing and testing in agent worktrees

This repository is a pnpm monorepo. Each agent should make changes and run its
own frontend/backend from its own worktree, so its code and dev servers are
isolated from other agents and the main checkout.

## Start from a worktree

1. From the worktree root, install dependencies (each worktree needs its own
   `node_modules`):

   ```sh
   pnpm install
   ```

2. Create local environment files for this worktree. `.env` is gitignored; do
   not commit it. If the main checkout has working local environment files,
   copy them into this worktree, then adjust ports and URLs for this worktree:

   ```sh
   cp /path/to/main-checkout/packages/backend/.env packages/backend/.env
   cp /path/to/main-checkout/packages/frontend/.env packages/frontend/.env
   ```

   If the main checkout does not have those files, copy the examples instead:

   ```sh
   cp packages/backend/.env.example packages/backend/.env
   cp packages/frontend/.env.example packages/frontend/.env
   ```

   Fill in valid local credentials/secrets only from an approved source. Never
   print, paste into agent output, or commit secrets. Do not copy `.env` from a
   worktree belonging to another agent unless explicitly authorized.

3. Choose an unused backend port (the default is `5000`) and keep the backend
   settings in sync. Set `PORT` in `packages/backend/.env`, and set
   `BETTER_AUTH_URL` and `VITE_API_URL` to
   `http://<server-lan-ip>:<backend-port>`. Use the server's LAN IP for every
   frontend/backend URL — never `localhost`, `127.0.0.1`, a public IP, or a
   hostname.
   The backend will try successive ports if `PORT` is occupied. If it does,
   update `BETTER_AUTH_URL` and `VITE_API_URL` to the actual port printed by the
   backend, then restart both services so API requests and auth use that port.

4. Start the frontend and note the exact URL/port Vite prints:

   ```sh
   pnpm dev:frontend
   ```

   Vite binds to `0.0.0.0` for access from the host network and automatically
   advances from `5173` when that port is occupied. Set `FRONTEND_URL` in
   `packages/backend/.env` to the exact frontend origin using that same
   server LAN IP (for example, `http://<server-lan-ip>:5174`). This is required
   for CORS and auth. Restart affected processes after editing `.env`.

5. In a second terminal, start the backend:

   ```sh
   pnpm dev:backend
   ```

   The backend binds to `0.0.0.0`, tries the configured `PORT`, and advances
   while a port is occupied. Check its startup output for the actual port, then
   verify `http://<server-lan-ip>:<backend-port>/health` returns
   `{"ok":true}`.

   Also verify that CORS allows the exact frontend origin. A successful HTTP
   status (including `200`) does not by itself mean the browser accepted the
   response. For example, with `curl`:

   ```sh
   curl -i "http://<server-lan-ip>:<backend-port>/api/auth/get-session" \
     -H "Origin: http://<server-lan-ip>:<frontend-port>"
   ```

   Confirm `Access-Control-Allow-Origin` exactly matches
   `http://<server-lan-ip>:<frontend-port>` and
   `Access-Control-Allow-Credentials: true` is present. If not, correct
   `FRONTEND_URL` in the backend `.env` and restart the backend. If the backend
   selected a different port than configured, also correct `BETTER_AUTH_URL`
   and the frontend's `VITE_API_URL`, then restart both services.

6. Test using the local login credentials in `AGENTS.local.md`. If those
   credentials do not work, ask the user for updated credentials; do not guess
   or create an account.

## Host-network access and safety

Binding to `0.0.0.0` makes the dev servers reachable on the machine's network
interfaces, not just from localhost. This is needed when developing on a
remote/BBS server and testing from another device. Use the server's LAN IP and
the printed port from that device. Ensure the server firewall allows only the
access you need; do not expose development servers or
credential-bearing endpoints publicly without authorization. `allowedHosts` in
the Vite config must also permit the hostname used to access the frontend.

## Worktree hygiene

- Keep changes isolated to the requested task and commit from the repository
  root. Never stage `packages/frontend` or `packages/backend` as gitlinks.
- Never commit `.env`, `AGENTS.local.md`, credentials, or generated local data.
- Use `pnpm` only; installs always run at the worktree root.
- Stop the dev processes when finished. When reporting test results, include
  the actual frontend/backend ports and any setup limitations, but never include
  secret values.
- For detailed environment setup notes, see [env-setup.md](env-setup.md).
