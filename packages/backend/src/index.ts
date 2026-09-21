import express, { type Express } from "express";
import cors from "cors";
import morgan from "morgan";
import os from "node:os";
import { authHandler } from "./auth.js";
import { env } from "./env.js";
import { connectDb } from "./db.js";
import { seedDefaults } from "./services/config.js";
import sessionsRouter from "./routes/sessions.js";
import connectionsRouter from "./routes/connections.js";
import configRouter from "./routes/config.js";
import modelsRouter from "./routes/models.js";

const app: Express = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Better-Auth handler (must be mounted before JSON-consuming routers only
// for its own path; express.json() above is fine since the handler reads
// the raw Node request itself).
app.all("/api/auth/*", authHandler);

app.use("/api/sessions", sessionsRouter);
app.use("/api/connections", connectionsRouter);
app.use("/api/config", configRouter);
app.use("/api/models", modelsRouter);

async function main() {
  const mongo = await connectDb();
  console.log(
    `MongoDB connected: ${mongo.connection.host}/${mongo.connection.name}`,
  );
  await seedDefaults();
  app.listen(env.PORT, () => {
    console.log(`d-backend listening on http://localhost:${env.PORT}`);
    const lanIp = getLanIp();
    if (lanIp) console.log(`d-backend on LAN: http://${lanIp}:${env.PORT}`);
  });
}

function getLanIp(): string | undefined {
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return undefined;
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
