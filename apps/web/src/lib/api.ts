import { createVideoCvClient } from "@video-cv/api-client";
import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export const apiClient = createVideoCvClient({
  baseUrl: API_URL,
  baseWsUrl: WS_URL,
});

/** Re-attach the stored token (call after hydration). */
export function syncToken(): void {
  const token = getToken();
  apiClient.setToken(token);
}
