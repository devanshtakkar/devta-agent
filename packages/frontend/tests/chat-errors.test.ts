import assert from "node:assert/strict";
import { test } from "node:test";
import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ApiError, ApiNetworkError } from "../src/lib/api-error.ts";
import { chatErrorMessage, fetchChat } from "../src/lib/chat-errors.ts";

function sendChat() {
  return new DefaultChatTransport({ fetch: fetchChat }).sendMessages({
    abortSignal: undefined,
    chatId: "test-chat",
    messageId: undefined,
    messages: [],
    trigger: "submit-message",
  });
}

test("HTML and JSON 413 responses show size guidance instead of the raw response", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected fetch");
  });
  for (const response of [
    new Response("<html>413 Content Too Large</html>", { status: 413 }),
    Response.json({ error: "Image is too large." }, { status: 413 }),
  ]) {
    fetchMock.mock.mockImplementationOnce(async () => response);
    await assert.rejects(sendChat(), (error: Error) => {
      assert.match(chatErrorMessage(error, "send", true), /too large \(413\).*fewer or smaller images.*new chat/);
      assert.match(chatErrorMessage(error, "send"), /too large \(413\).*shorter message/);
      return true;
    });
  }
});

test("a blocked or failed fetch offers image-specific steps without claiming a 413", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(sendChat(), (error: Error) => {
    assert.match(chatErrorMessage(error, "send", true), /Check your connection.*fewer or smaller images/);
    assert.doesNotMatch(chatErrorMessage(error, "send", true), /413/);
    assert.match(chatErrorMessage(error, "send"), /Check your connection.*retry/i);
    return true;
  });
});

test("aborting a send leaves the original abort error intact", async (t) => {
  const controller = new AbortController();
  const reason = new DOMException("Stopped", "AbortError");
  controller.abort(reason);
  t.mock.method(globalThis, "fetch", async () => {
    throw reason;
  });
  await assert.rejects(fetchChat("/chat", { signal: controller.signal }), (error) => error === reason);
});

test("successful chat responses still stream normally", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response('data: {"type":"start","messageId":"reply"}\n\ndata: [DONE]\n\n'),
  );
  const reader = (await sendChat()).getReader();
  assert.deepEqual(await reader.read(), { done: false, value: { type: "start", messageId: "reply" } });
  assert.equal((await reader.read()).done, true);
});

for (const [status, guidance] of [
  [400, /server couldn’t accept this message.*editing/],
  [401, /sign in again/],
  [403, /doesn’t have permission/],
  [404, /no longer available.*start a new one/],
  [409, /rejected the request \(409\)/],
  [429, /Too many requests.*Wait/],
  [500, /server ran into an error \(500\)/],
  [502, /temporarily unavailable \(502\)/],
  [503, /temporarily unavailable \(503\)/],
  [504, /timed out.*Retry/],
] as const) {
  test(`HTTP ${status} shows actionable guidance without raw proxy content`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => new Response("<html>Internal details</html>", { status }));
    await assert.rejects(sendChat(), (error: Error) => {
      const message = chatErrorMessage(error, "send");
      assert.match(message, guidance);
      assert.doesNotMatch(message, /html|Internal details/);
      return true;
    });
  });
}

test("a full session tells the user to start a new chat rather than retry", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Session is full (100 messages max)" }, { status: 400 }),
  );
  await assert.rejects(sendChat(), (error: Error) => {
    assert.match(chatErrorMessage(error, "send"), /100-message limit.*Start a new chat/);
    return true;
  });
});

test("a streamed error leaves chat retryable without displaying provider internals", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response('data: {"type":"error","errorText":"Internal provider details"}\n\ndata: [DONE]\n\n'),
  );
  const chat = new Chat({ transport: new DefaultChatTransport({ fetch: fetchChat }) });
  await chat.sendMessage({ text: "Hello" });
  assert.equal(chat.status, "error");
  assert.equal(chatErrorMessage(chat.error, "send"), "Couldn’t get a complete reply. Retry from your last message.");
});

test("opening, starting, and saving a chat model get action-specific guidance", () => {
  const offline = new ApiNetworkError(new TypeError("Failed to fetch"));
  assert.match(chatErrorMessage(offline, "open"), /open this chat.*Check your connection.*Try again/);
  assert.match(chatErrorMessage(offline, "create"), /start a new chat.*Check your connection.*sending again/);
  assert.match(chatErrorMessage(new ApiError(400, null, "Invalid id"), "open"), /link is invalid/);
  assert.match(chatErrorMessage(new Error("Unexpected"), "save-model"), /save your model selection.*choosing the model again/);
});
