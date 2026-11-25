class ChatRequestError extends Error {
  status?: number;

  constructor(status?: number, options?: ErrorOptions) {
    super(
      status === undefined ? "Chat request could not connect" : `Chat request failed (${status})`,
      options,
    );
    this.name = "ChatRequestError";
    this.status = status;
  }
}

/** Preserve HTTP 413 even when the proxy responds with an HTML error page. */
export const fetchChat: typeof fetch = async (input, init) => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError && !init?.signal?.aborted) {
      throw new ChatRequestError(undefined, { cause: error });
    }
    throw error;
  }

  if (response.status === 413) {
    await response.body?.cancel().catch(() => {});
    throw new ChatRequestError(response.status);
  }
  return response;
};

export function chatErrorMessage(error: Error | undefined, hasImages: boolean): string {
  if (error instanceof ChatRequestError && error.status === 413) {
    return hasImages
      ? "This chat request is too large (413). Send fewer or smaller images. If you’ve shared images earlier in this chat, try a new chat."
      : "This chat request is too large (413). Try a shorter message or start a new chat.";
  }
  if (error instanceof ChatRequestError && error.status === undefined) {
    // A cross-origin proxy rejection can look like a network failure to fetch.
    return hasImages
      ? "Couldn’t reach the chat server. Check your connection. If this keeps happening with images, try fewer or smaller images, or start a new chat."
      : "Couldn’t reach the chat server. Check your connection and retry from your last message.";
  }
  return "Something went wrong. Retry from your last message.";
}
