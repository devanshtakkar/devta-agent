import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_API_URL as string | undefined;

export const authClient = createAuthClient({
  baseURL: baseURL ?? "http://localhost:3001",
});

export const { useSession } = authClient;
