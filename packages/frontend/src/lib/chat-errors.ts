import { ApiError, ApiNetworkError, fetchApi, readApiError } from "./api-error.ts";

export const fetchChat: typeof fetch = async (input, init) => {
  // The SDK's default error throws only the response text, losing the status.
  const response = await fetchApi(input, init);
  if (!response.ok) throw await readApiError(response);
  return response;
};

const messages = {
  send: {
    failure: "Couldn’t get a complete reply.",
    retry: "Retry from your last message.",
  },
  open: { failure: "Couldn’t open this chat.", retry: "Try again." },
  create: { failure: "Couldn’t start a new chat.", retry: "Try sending again." },
  "save-model": { failure: "Couldn’t save your model selection.", retry: "Try choosing the model again." },
};

export function chatErrorMessage(
  error: unknown,
  action: keyof typeof messages,
  hasImages = false,
): string {
  const { failure, retry } = messages[action];
  if (error instanceof ApiNetworkError) {
    // A cross-origin proxy rejection can look like a network failure to fetch.
    const next = hasImages && action === "send"
      ? "If it keeps happening with images, try fewer or smaller images, or start a new chat."
      : retry;
    return `${failure} Check your connection. ${next}`;
  }

  if (!(error instanceof ApiError)) return `${failure} ${retry}`;

  const { status, body } = error;
  switch (status) {
    case 400: {
      const detail = typeof body === "object" && body !== null && "error" in body ? body.error : null;
      if (action === "send") {
        const full = typeof detail === "string" && /^Session is full \((\d+) messages max\)$/.exec(detail);
        if (full) return `This chat reached its ${full[1]}-message limit. Start a new chat to continue.`;
        return hasImages
          ? "The server couldn’t accept this message. Try removing or reattaching its images before sending again."
          : "The server couldn’t accept this message. Try editing it before sending again.";
      }
      if (action === "open") return "This chat link is invalid. Open a chat from your history or start a new one.";
      break;
    }
    case 401:
      return `${failure} Reload the app and sign in again.`;
    case 403:
      return `${failure} Your account doesn’t have permission. Check that you’re signed in to the right account.`;
    case 404:
      if (action !== "create") return "This chat is no longer available. Open a chat from your history or start a new one.";
      break;
    case 408:
    case 504:
      return `${failure} The request timed out. ${retry}`;
    case 413:
      if (action !== "send") break;
      return hasImages
        ? "This chat request is too large (413). Send fewer or smaller images. If you’ve shared images earlier in this chat, try a new chat."
        : "This chat request is too large (413). Try a shorter message or start a new chat.";
    case 429:
      return `${failure} Too many requests. Wait a moment before trying again.`;
    case 502:
    case 503:
      return `${failure} The chat service is temporarily unavailable (${status}). Try again in a moment.`;
  }
  return status >= 500
    ? `${failure} The server ran into an error (${status}). Try again in a moment.`
    : `${failure} The server rejected the request (${status}). ${retry}`;
}
