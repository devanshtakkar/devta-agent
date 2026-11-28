export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class ApiNetworkError extends TypeError {
  constructor(cause: TypeError) {
    super("Network request failed", { cause });
    this.name = "ApiNetworkError";
  }
}

export const fetchApi: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError && !init?.signal?.aborted) {
      throw new ApiNetworkError(error);
    }
    throw error;
  }
};

export async function readApiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // Non-JSON errors may come from a proxy. UI copy should not use the raw body.
  }
  return new ApiError(response.status, body, text || `Request failed: ${response.status}`);
}
