import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { admin } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import type { NextFunction, Request, Response } from "express";
import { env } from "./env.js";

const client = new MongoClient(env.MONGODB_URI);
const db = client.db();

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.FRONTEND_URL],
  database: mongodbAdapter(db, { client }),
  // Admin plugin exposes `auth.api.createUser` server-side so the personal
  // owner account can be provisioned via `pnpm create-user` (see docs/).
  // Public sign-up stays enabled on the API; the frontend just hides it.
  plugins: [admin()],
  emailAndPassword: {
    enabled: true,
  },
});

export const authHandler = toNodeHandler(auth);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    (req as Request & { user?: unknown; session?: unknown }).user =
      session.user;
    (req as Request & { user?: unknown; session?: unknown }).session =
      session.session;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
