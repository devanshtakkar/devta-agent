import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessage } from "ai";
import { Connection } from "../src/models/Connection.js";
import {
  buildConnectionContext,
  connectionHistory,
  connectionHistoryTools,
  connectionSnapshot,
  withoutConnectionHistory,
  CONNECTION_CONTEXT_BYTES,
  CONNECTION_HISTORY_BYTES,
  type ContextConnection,
} from "../src/ai/connection-context.js";

function fixture(count = 12): ContextConnection {
  return {
    uuid: "a513339d-b4dd-4d8a-8ca3-ed8d9e548f10",
    name: "Updated name",
    stage: "flaked",
    metLocation: "Updated cafe",
    updatedAt: new Date("2026-10-07T12:00:00Z"),
    events: Array.from({ length: count }, (_, index) => ({
      id: `event-${index}`,
      type: "note",
      title: `Interaction ${index}`,
      details: "A short interaction.",
      occurredAt: new Date(Date.UTC(2026, 9, index + 1)),
    })),
  };
}

test("snapshot contains current basic details and only five latest dated events", () => {
  const snapshot = JSON.parse(connectionSnapshot(fixture()));
  assert.equal(snapshot.current.name, "Updated name");
  assert.equal(snapshot.current.status, "flaked");
  assert.equal(snapshot.current.location, "Updated cafe");
  assert.equal(snapshot.current.connectionId, fixture().uuid);
  assert.equal(snapshot.current.updatedAt, "2026-10-07T12:00:00.000Z");
  assert.deepEqual(snapshot.history.events.map((event: { id: string }) => event.id),
    ["event-11", "event-10", "event-9", "event-8", "event-7"]);
  assert.equal(snapshot.history.events[0].occurredAt, "2026-10-12T00:00:00.000Z");
  assert.equal(snapshot.history.totalEvents, 12);
  assert.equal(snapshot.history.nextOffset, 5);
});

test("snapshot uses occurrence dates rather than event insertion order", () => {
  const connection = fixture(3);
  connection.events.reverse();
  const snapshot = JSON.parse(connectionSnapshot(connection));
  assert.equal(snapshot.history.events[0].id, "event-2");
  assert.equal(connection.events[0].id, "event-2");
});

test("JSON stays within byte budgets for oversized Unicode and escaped text", () => {
  const connection = fixture(20);
  connection.name = "\u0000".repeat(120);
  connection.metLocation = "\u0000".repeat(200);
  for (const event of connection.events) {
    event.title = "🎉".repeat(1_000);
    event.details = "\u0000🎉\"\\".repeat(4_000);
    event.location = "🎉".repeat(200);
  }
  const snapshot = connectionSnapshot(connection);
  assert.ok(Buffer.byteLength(snapshot) <= CONNECTION_CONTEXT_BYTES);
  const data = JSON.parse(snapshot);
  assert.equal(data.current.name, connection.name);
  assert.equal(data.current.location, connection.metLocation);
  assert.ok(data.history.events.length > 0);
  assert.ok(data.history.events.length <= 5);
  assert.equal(data.history.nextOffset, data.history.events.length);
  const history = connectionHistory(connection, data.history.nextOffset);
  assert.ok(Buffer.byteLength(history) <= CONNECTION_HISTORY_BYTES);
  assert.ok(JSON.parse(history).events[0].details.endsWith("…"));
});

test("history pages cover older events without duplicates or skips", () => {
  const connection = fixture();
  const ids: string[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = JSON.parse(connectionHistory(connection, offset));
    ids.push(...page.events.map((event: { id: string }) => event.id));
    offset = page.nextOffset;
  }
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  assert.equal(ids.at(-1), "event-0");
  assert.deepEqual(JSON.parse(connectionHistory(connection, 50)).events, []);
});

test("empty timelines still provide current status without inventing history", () => {
  const snapshot = JSON.parse(connectionSnapshot(fixture(0)));
  assert.equal(snapshot.current.status, "flaked");
  assert.deepEqual(snapshot.history.events, []);
  assert.equal(snapshot.history.nextOffset, null);
});

test("each request sees manual edits and event deletion immediately", async (context) => {
  const connection = fixture(2);
  context.mock.method(Connection, "findOne", () => ({
    select: () => ({ lean: async () => connection }),
  }));
  const before = await buildConnectionContext("user-a", "chat-a");
  connection.name = "Corrected name";
  connection.stage = "declined";
  connection.metLocation = "Corrected location";
  connection.events.pop();
  const after = await buildConnectionContext("user-a", "chat-a");
  assert.ok(before.includes("Updated name"));
  assert.ok(after.includes("Corrected name"));
  assert.ok(after.includes('"status":"declined"'));
  assert.ok(after.includes("Corrected location"));
  assert.ok(!after.includes("event-1"));
  assert.ok(after.includes("override older chat references"));
});

test("snapshot and history lookup are both scoped to authenticated user and chat", async (context) => {
  const filters: unknown[] = [];
  context.mock.method(Connection, "findOne", (filter: { userId: string; originSessionId: string }) => {
    filters.push(filter);
    return {
      select: () => ({
        lean: async () => filter.userId === "user-a" && filter.originSessionId === "chat-a"
          ? fixture()
          : null,
      }),
    };
  });
  assert.equal(await buildConnectionContext("user-b", "chat-a"), "");
  assert.equal(await buildConnectionContext("user-a", "chat-b"), "");
  const options = { toolCallId: "test", messages: [] };
  const allowed = connectionHistoryTools("user-a", "chat-a").readConnectionHistory;
  const page = await allowed.execute!({ offset: 5 }, options);
  assert.equal(page.connectionId, fixture().uuid);
  assert.equal(page.events[0].id, "event-6");
  const denied = connectionHistoryTools("user-b", "chat-a").readConnectionHistory;
  assert.equal((await denied.execute!({ offset: 0 }, options)).connection, null);
  assert.deepEqual(filters, [
    { userId: "user-b", originSessionId: "chat-a" },
    { userId: "user-a", originSessionId: "chat-b" },
    { userId: "user-a", originSessionId: "chat-a" },
    { userId: "user-b", originSessionId: "chat-a" },
  ]);
});

test("history tool results are not re-sent on later turns, but chat text and proposals remain", () => {
  const messages: UIMessage[] = [{
    id: "assistant-1",
    role: "assistant",
    parts: [
      { type: "text", text: "A coaching response." },
      {
        type: "tool-readConnectionHistory",
        toolCallId: "history-1",
        state: "output-available",
        input: { offset: 5 },
        output: { events: ["stale historical data"] },
      },
      {
        type: "dynamic-tool",
        toolName: "readConnectionHistory",
        toolCallId: "history-2",
        state: "output-available",
        input: { offset: 10 },
        output: { events: ["more stale data"] },
      },
      {
        type: "tool-proposeConnection",
        toolCallId: "proposal-1",
        state: "output-available",
        input: { name: "Test" },
        output: { name: "Test" },
      },
    ],
  }];
  const filtered = withoutConnectionHistory(messages);
  assert.deepEqual(filtered[0].parts.map((part) => part.type), ["text", "tool-proposeConnection"]);
  assert.equal(messages[0].parts.length, 4);
  assert.ok(!JSON.stringify(filtered).includes("stale"));
});

test("parallel history calls share a two-read limit that resets for the next turn", async (context) => {
  let reads = 0;
  context.mock.method(Connection, "findOne", () => {
    reads++;
    return { select: () => ({ lean: async () => fixture(30) }) };
  });
  const history = connectionHistoryTools("user-a", "chat-a").readConnectionHistory;
  const results = await Promise.all([0, 5, 10, 15].map((offset) =>
    history.execute!({ offset }, { toolCallId: `history-${offset}`, messages: [] }),
  ));
  assert.equal(reads, 2);
  assert.equal(results.filter((result) => result.events).length, 2);
  assert.equal(results.filter((result) => result.limitReached).length, 2);
  const nextTurn = connectionHistoryTools("user-a", "chat-a").readConnectionHistory;
  assert.ok((await nextTurn.execute!({ offset: 10 }, { toolCallId: "next", messages: [] })).events);
  assert.equal(reads, 3);
});
