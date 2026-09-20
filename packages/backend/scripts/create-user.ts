/**
 * Create the personal owner user via the better-auth admin API.
 *
 * Usage (from repo root or packages/backend):
 *   pnpm --filter d-backend create-user -- --email you@example.com --password "secret-12-chars+" --name "Your Name"
 *
 * The script calls `auth.api.createUser` directly (no HTTP session needed),
 * which is exposed by the `admin()` plugin in src/auth.ts.
 */
import { auth } from "../src/auth.js";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const email = getArg("--email");
const password = getArg("--password");
const name = getArg("--name") ?? email?.split("@")[0] ?? "Owner";

if (!email || !password) {
  console.error(
    'Usage: pnpm --filter d-backend create-user -- --email you@example.com --password "12-chars-minimum" [--name "Your Name"]',
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

try {
  const result = await auth.api.createUser({
    body: { email, password, name, role: "admin" },
  });
  console.log(`User created: ${result.user.email} (id: ${result.user.id})`);
  console.log("You can now sign in on the frontend login screen.");
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes("already exists")) {
    console.error(`User already exists: ${email}`);
  } else {
    console.error(`Failed to create user: ${message}`);
  }
  process.exit(1);
}
