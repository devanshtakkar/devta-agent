# Personal Login

This app is for personal use. The frontend shows a login form only — there is
no sign-up screen. Your account is created once from the backend with the
better-auth admin API, then you sign in with it.

## How it works

- `packages/backend/src/auth.ts` includes the better-auth `admin()` plugin,
  which exposes `auth.api.createUser` server-side.
- `packages/backend/scripts/create-user.ts` calls `auth.api.createUser`
  directly (no HTTP session needed) with the email/password you pass.
- The frontend (`packages/frontend/src/components/AuthForm.tsx`) only calls
  `authClient.signIn.email` — sign-up is hidden from the UI, not blocked on
  the API.

## Prerequisites

- Backend `.env` is configured (`MONGODB_URI`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, SMTP vars). See `packages/backend/.env.example`.
- Dependencies installed from the repo root: `pnpm install`.

## Create your user (run once)

From the repo root:

```powershell
pnpm --filter d-backend create-user -- --email you@example.com --password "your-12-char-password" --name "Your Name"
```

- `--email` (required): the address you will log in with.
- `--password` (required): minimum 8 characters.
- `--name` (optional): defaults to the part of the email before `@`.
- The user is created with role `admin`.

Expected output:

```text
User created: you@example.com (id: ...)
You can now sign in on the frontend login screen.
```

If the email already exists, the script exits with
`User already exists: you@example.com` — nothing is overwritten.

## Sign in

1. Start the backend and frontend (`pnpm dev:backend`, `pnpm dev:frontend`).
2. Open the frontend and enter the email + password you used in the script.
3. Password reset / verification emails (if triggered) come from your SMTP
   sender configured in the backend `.env`.

## Notes

- To change your password later, use the normal reset-password flow or
  re-run the flow via `authClient.admin.setUserPassword` / the admin API.
- Keep your credentials out of git — never commit `.env`.
