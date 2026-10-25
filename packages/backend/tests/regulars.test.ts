import assert from "node:assert/strict";
import { test } from "node:test";
import os from "node:os";
import express from "express";
import { Regular } from "../src/models/Regular.js";

test("regular API validates input, isolates owners, and supports the full shift lifecycle", async (context) => {
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find((a) => a?.family === "IPv4" && !a.internal)?.address;
  assert.ok(ip, "LAN address required for HTTP test");
  process.env.FRONTEND_URL = `http://${ip}:5173`;
  process.env.BETTER_AUTH_URL = `http://${ip}:5000`;
  process.env.BETTER_AUTH_SECRET =
    "test-only-secret-not-a-real-credential-123456789";
  process.env.MONGODB_URI = `mongodb://${ip}:27017/test`;
  process.env.OPENROUTER_API_KEY = "test-only";
  const { auth } = await import("../src/auth.js");
  const { default: router } = await import("../src/routes/regulars.js");
  let owner: string | null = "user-a";
  context.mock.method(auth.api, "getSession", async () =>
    owner ? { user: { id: owner }, session: {} } : null,
  );
  const store: any[] = [];
  context.mock.method(Regular, "find", (filter: { userId: string }) => ({
    sort: () => ({ lean: async () => store.filter(d => d.userId === filter.userId).map(d => d.toObject()) }),
  }));
  context.mock.method(Regular, "create", async (fields: any) => {
    const doc = new Regular(fields);
    doc.save = async () => doc;
    store.push(doc);
    return doc;
  });
  context.mock.method(
    Regular,
    "findOne",
    async (filter: any) =>
      store.find((d) => d.uuid === filter.uuid && d.userId === filter.userId) ??
      null,
  );
  context.mock.method(Regular, "deleteOne", async (filter: any) => {
    const i = store.findIndex(
      (d) => d.uuid === filter.uuid && d.userId === filter.userId,
    );
    if (i >= 0) store.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  });
  const app = express();
  app.use(express.json());
  app.use("/api/regulars", router);
  const server = app.listen(0, "0.0.0.0");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  context.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address() as { port: number };
  const call = (path: string, method = "GET", body?: unknown) =>
    fetch(`http://${ip}:${address.port}/api/regulars${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  assert.equal(
    (await call("", "POST", { name: "", venue: "Cafe" })).status,
    400,
  );
  const created = await call("", "POST", {
    name: "Test regular",
    venue: "Test cafe",
  });
  assert.equal(created.status, 201);
  const { uuid } = await created.json();
  const path = `/${uuid}`;
  owner = "user-b";
  assert.deepEqual((await (await call("")).json()).regulars, []);
  assert.equal((await call(path)).status, 404);
  assert.equal((await call(path, "PATCH", { name: "Other" })).status, 404);
  assert.equal((await call(`${path}?confirm=CONFIRM`, "DELETE")).status, 404);
  owner = null;
  assert.equal((await call(path)).status, 401);
  owner = "user-a";
  assert.equal((await (await call("")).json()).regulars.length, 1);
  const shift = {
    kind: "sighting",
    occurredOn: "2026-01-05",
    startTime: "10:00",
  };
  const added = await call(`${path}/shifts`, "POST", shift);
  assert.equal(added.status, 201);
  const entry = (await added.json()).shifts[0];
  assert.equal((await call(`${path}/shifts`, "POST", shift)).status, 409);
  const edited = await call(`${path}/shifts/${entry.id}`, "PATCH", {
    ...shift,
    startTime: "11:00",
  });
  assert.equal((await edited.json()).shifts[0].startTime, "11:00");
  assert.equal(
    (
      await call(`${path}/shifts`, "POST", {
        kind: "declared",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "12:00",
      })
    ).status,
    201,
  );
  assert.equal(
    (await call(`${path}/shifts/${entry.id}`, "DELETE")).status,
    200,
  );
  assert.equal((await call(path, "PATCH", { status: "paused" })).status, 200);
  assert.equal((await call(path, "DELETE")).status, 409);
  assert.equal((await call(`${path}?confirm=CONFIRM`, "DELETE")).status, 204);
  assert.equal((await call(path)).status, 404);
});
