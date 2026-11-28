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

3. Give this worktree its own MongoDB database. On the shared server, read the
   agent connection URI from `/root/.config/mongodb/dev_agent.uri` and set
   `MONGODB_URI` in `packages/backend/.env`. Do this even if you copied a
   working backend `.env` from the main checkout.

   Use a unique database name for this worktree, such as
   `devta_wt_groovy_hedgehog`. Put it in the URI's database path, after the
   host and before `?` (for example, `.../devta_wt_groovy_hedgehog?...`).
   Preserve the credentials and query options from the saved URI, including
   `authSource`. The backend and Better Auth both use the database selected
   by this URI. MongoDB creates the database on the first write, so agents
   can start with an empty database without using the admin URI or writing
   to the main checkout's database.

4. Choose an unused backend port (the default is `5000`) and keep the backend
   settings in sync. Set `PORT` in `packages/backend/.env`, and set
   `BETTER_AUTH_URL` and `VITE_API_URL` to
   `http://<server-public-ip>:<backend-port>`. Use the server's public IP for
   every frontend/backend URL. Do not use localhost, private IPs, or tunnels.
   The backend will try successive ports if `PORT` is occupied. If it does,
   update `BETTER_AUTH_URL` and `VITE_API_URL` to the actual port printed by the
   backend, then restart both services so API requests and auth use that port.

5. Start the frontend and note the exact URL/port Vite prints:

   ```sh
   pnpm dev:frontend
   ```

   Vite binds to `0.0.0.0` for access from the host network and automatically
   advances from `5173` when that port is occupied. Set `FRONTEND_URL` in
   `packages/backend/.env` to the exact frontend origin using that same
   server public IP (for example, `http://<server-public-ip>:5174`). This is required
   for CORS and auth. Restart affected processes after editing `.env`.

6. In a second terminal, start the backend:

   ```sh
   pnpm dev:backend
   ```

   The backend binds to `0.0.0.0`, tries the configured `PORT`, and advances
   while a port is occupied. Check its startup output for the actual port, then
   verify `http://<server-public-ip>:<backend-port>/health` returns
   `{"ok":true}`.

   Also verify that CORS allows the exact frontend origin. A successful HTTP
   status (including `200`) does not by itself mean the browser accepted the
   response. For example, with `curl`:

   ```sh
   curl -i "http://<server-public-ip>:<backend-port>/api/auth/get-session" \
     -H "Origin: http://<server-public-ip>:<frontend-port>"
   ```

   Confirm `Access-Control-Allow-Origin` exactly matches
   `http://<server-public-ip>:<frontend-port>` and
   `Access-Control-Allow-Credentials: true` is present. If not, correct
   `FRONTEND_URL` in the backend `.env` and restart the backend. If the backend
   selected a different port than configured, also correct `BETTER_AUTH_URL`
   and the frontend's `VITE_API_URL`, then restart both services.

7. Test using the local login credentials in `AGENTS.local.md`. A fresh
   worktree database does not contain accounts from the main checkout. If
   those credentials do not work, ask the user for updated credentials or to
   provision the test account in this database; do not guess or create an
   account.

## Public access

Run the dev servers directly on the host network, bound to `0.0.0.0`. Share
the frontend URL using the server's public IP and the actual Vite port, so it
opens from another device. Keep the database and other internal services on
their existing interfaces.

## Worktree hygiene

- Keep changes isolated to the requested task and commit from the repository
  root. Never stage `packages/frontend` or `packages/backend` as gitlinks.
- Never commit `.env`, `AGENTS.local.md`, credentials, or generated local data.
- Use `pnpm` only; installs always run at the worktree root.
- Stop the dev processes when finished. When reporting test results, include
  the actual frontend/backend ports and any setup limitations, but never include
  secret values.
- For Windows-specific port and frontend setup, see
  [env-setup.md](env-setup.md). Use the MongoDB setup above for worktrees on
  the shared server.
