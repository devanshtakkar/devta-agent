import assert from "node:assert/strict";
import { test } from "node:test";
import {
  messageTimeSchema,
  messageTimeline,
  timestampUserMessages,
} from "../src/ai/message-timeline.js";

test("the coach sees the browser's local date and time when the UTC date differs", () => {
  const receivedAt = new Date("2026-11-27T18:45:10Z");
  const clientTime = messageTimeSchema.parse({
    sentAt: "2026-11-27T18:45:00.000Z",
    timeZone: "Asia/Kolkata",
  });
  const messages = timestampUserMessages(
    [{ id: "first", role: "user", metadata: clientTime }],
    [],
    receivedAt,
  );

  assert.deepEqual(messages[0].metadata, clientTime);
  const timeline = messageTimeline(messages, receivedAt, clientTime);
  assert.match(timeline, /User's local time at this request: Sat, Nov 28, 2026.*12:15 AM GMT\+05:30 \(Asia\/Kolkata\)/);
  assert.match(timeline, /User update 1: Sat, Nov 28, 2026.*12:15 AM GMT\+05:30 \(Asia\/Kolkata\)/);
  assert.doesNotMatch(timeline, /server time/);
});

test("retries keep original message times and calculate elapsed time across DST", () => {
  const first = {
    id: "first",
    role: "user" as const,
    metadata: { sentAt: "2026-03-08T06:55:00.000Z", timeZone: "America/New_York" },
  };
  const second = {
    id: "second",
    role: "user" as const,
    metadata: { sentAt: "2026-03-08T07:05:00.000Z", timeZone: "America/New_York" },
  };
  const clientTime = { sentAt: "2026-03-09T02:00:00.000Z", timeZone: "America/Chicago" };
  const receivedAt = new Date(clientTime.sentAt);
  const messages = timestampUserMessages(
    [{ ...first, metadata: clientTime }, second],
    [first, second],
    receivedAt,
  );

  assert.deepEqual(messages, [first, second]);
  const timeline = messageTimeline(messages, receivedAt, clientTime);
  assert.match(timeline, /User's local time at this request:.*9:00 PM GMT-05:00 \(America\/Chicago\)/);
  assert.match(timeline, /User update 1:.*1:55 AM GMT-05:00 \(America\/New_York\)/);
  assert.match(timeline, /User update 2:.*3:05 AM GMT-04:00 \(America\/New_York\) \(10 minutes since the previous timestamped update\)/);
});

test("legacy and invalid time metadata do not invent a local time zone or overwrite history", () => {
  const legacy = [
    { id: "undated", role: "user" as const },
    { id: "utc", role: "user" as const, metadata: { sentAt: "2026-11-26T17:00:00.000Z" } },
  ];
  const receivedAt = new Date("2026-11-27T17:00:00Z");
  const badTime = { sentAt: "next Monday", timeZone: "Invalid/Zone" };
  const messages = timestampUserMessages(
    [...legacy, { id: "new", role: "user", metadata: badTime }],
    legacy,
    receivedAt,
  );

  const timeline = messageTimeline(messages, receivedAt, messageTimeSchema.parse(badTime));
  assert.match(timeline, /Current time in UTC \(user's local time zone unavailable\): 2026-11-27T17:00:00.000Z/);
  assert.match(timeline, /User update 1: timestamp unavailable/);
  assert.match(timeline, /User update 2: 2026-11-26T17:00:00.000Z/);
  assert.match(timeline, /User update 3: 2026-11-27T17:00:00.000Z \(1 day since the previous timestamped update\)/);
  assert.doesNotMatch(timeline, /Invalid\/Zone|next Monday/);
});
