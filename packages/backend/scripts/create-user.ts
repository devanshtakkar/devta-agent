/**
 * Create the personal owner user via the better-auth admin API.
 *
 * Interactive (prompts for email, name and password):
 *   pnpm --filter d-backend create-user
 *
 * Non-interactive (flags, useful for docs/CI):
 *   pnpm --filter d-backend create-user -- --email you@example.com --password "secret-12-chars+" --name "Your Name"
 *
 * The script calls `auth.api.createUser` directly (no HTTP session needed),
 * which is exposed by the `admin()` plugin in src/auth.ts.
 */
import * as readline from "node:readline";
import { auth } from "../src/auth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

/** Prompt for a visible value; falls back to `defaultValue` when left blank. */
function prompt(query: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

/** Prompt for a value without echoing it (masked with `*`). */
function promptHidden(query: string): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  // No TTY (piped input) — raw mode is unavailable, fall back to a plain read.
  if (!stdin.isTTY) {
    return prompt(query);
  }

  return new Promise((resolve) => {
    const wasRaw = stdin.isRaw;
    let value = "";

    stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = (result: string) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdout.write("\n");
      resolve(result);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish(value);
          return;
        }
        if (char === "\u0003") {
          // Ctrl+C
          stdin.setRawMode(wasRaw ?? false);
          stdout.write("\n");
          process.exit(1);
        }
        if (char === "\u007f" || char === "\b") {
          // Backspace
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          value += char;
          stdout.write("*");
        }
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  let email = getArg("--email")?.trim();
  let password = getArg("--password");
  let name = getArg("--name")?.trim();

  // Prompt for anything not supplied via flags.
  if (!email || !password) {
    console.log("Create a devta user (press Ctrl+C to cancel)\n");

    while (!email || !EMAIL_RE.test(email)) {
      if (email) console.error("  Please enter a valid email address.");
      email = await prompt("Email: ");
    }

    if (!name) {
      name = await prompt(`Name (${email.split("@")[0]}): `, email.split("@")[0]);
    }

    while (!password) {
      const first = await promptHidden("Password (min 8 chars): ");
      if (first.length < 8) {
        console.error("  Password must be at least 8 characters.");
        continue;
      }
      const confirm = await promptHidden("Confirm password: ");
      if (first !== confirm) {
        console.error("  Passwords do not match. Try again.");
        continue;
      }
      password = first;
    }

    console.log();
  }

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
      body: {
        email,
        password,
        name: name ?? email.split("@")[0],
        role: "admin",
      },
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
}

await main();
