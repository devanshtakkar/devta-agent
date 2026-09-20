/**
 * One-time dev cleanup: drop all chat sessions so the store starts on the
 * new message-stream schema (see `src/models/ChatSession.ts`).
 *
 * Usage:
 *   pnpm --filter d-backend reset-sessions
 */
import { connectDb } from "../src/db.js";
import { ChatSession } from "../src/models/ChatSession.js";

async function main() {
  await connectDb();
  const result = await ChatSession.deleteMany({});
  console.log(`Deleted ${result.deletedCount} chat sessions.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("reset-sessions failed:", err);
  process.exit(1);
});
