import assert from "node:assert/strict";
import { test } from "node:test";
import { DefaultChatTransport } from "ai";
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
      assert.match(chatErrorMessage(error, true), /too large \(413\).*fewer or smaller images.*new chat/);
      assert.match(chatErrorMessage(error, false), /too large \(413\).*shorter message/);
      return true;
    });
  }
});

test("a blocked or failed fetch offers image-specific steps without claiming a 413", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(sendChat(), (error: Error) => {
    assert.match(chatErrorMessage(error, true), /Check your connection.*fewer or smaller images/);
    assert.doesNotMatch(chatErrorMessage(error, true), /413/);
    assert.match(chatErrorMessage(error, false), /Check your connection.*retry/);
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

test("other failures retain the generic retry guidance", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Bad Gateway</html>", { status: 502 }));
  await assert.rejects(sendChat(), (error: Error) => {
    assert.equal(chatErrorMessage(error, true), "Something went wrong. Retry from your last message.");
    return true;
  });
});
