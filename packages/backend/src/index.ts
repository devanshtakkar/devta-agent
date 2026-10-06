import express, { type Express } from "express";
import cors from "cors";
import morgan from "morgan";
import os from "node:os";
import type { Server } from "node:http";
import { authHandler } from "./auth.js";
import { env } from "./env.js";
import { connectDb } from "./db.js";
import { seedDefaults } from "./services/config.js";
import sessionsRouter from "./routes/sessions.js";
import connectionsRouter from "./routes/connections.js";
import configRouter from "./routes/config.js";
import modelsRouter from "./routes/models.js";
import scenariosRouter from "./routes/scenarios.js";
import savedApproachesRouter from "./routes/saved-approaches.js";

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
app.use("/api/scenarios", scenariosRouter);
app.use("/api/saved-approaches", savedApproachesRouter);

async function main() {
  const mongo = await connectDb();
  console.log(
    `MongoDB connected: ${mongo.connection.host}/${mongo.connection.name}`,
  );
  await seedDefaults();
  const { server, port } = await listenOnAvailablePort(env.PORT);
  console.log(`d-backend listening on http://localhost:${port}`);
  if (port !== env.PORT) {
    console.warn(`Port ${env.PORT} is unavailable; using port ${port} instead.`);
  }
  {
    const lanIp = getLanIp();
    if (lanIp) console.log(`d-backend on LAN: http://${lanIp}:${port}`);
  }
}

function listenOnAvailablePort(startPort: number): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > 65535) {
        reject(new Error(`No available port found starting from ${startPort}.`));
        return;
      }

      const server = app.listen(port);
      server.once("listening", () => resolve({ server, port }));
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };

    tryPort(startPort);
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
