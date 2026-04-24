export { HttpClient, ApiError } from "./http-client";
export type { RequestOptions } from "./http-client";

export { AuthClient } from "./auth-client";
export type { RegisterPayload, LoginPayload, AuthResponse } from "./auth-client";

export { SessionClient } from "./session-client";
export type { CreateSessionResponse } from "./session-client";

export { ProfileClient } from "./profile-client";
export type { UpdateProfilePayload } from "./profile-client";

export { SearchClient } from "./search-client";
export type { SearchParams, SearchResponse } from "./search-client";

export { WsClient } from "./ws-client";
export type { WebSocketEventHandler } from "./ws-client";

import { HttpClient } from "./http-client";
import { AuthClient } from "./auth-client";
import { SessionClient } from "./session-client";
import { ProfileClient } from "./profile-client";
import { SearchClient } from "./search-client";
import { WsClient } from "./ws-client";

export interface VideoCvClientOptions {
  baseUrl: string;
  baseWsUrl?: string;
}

/**
 * Convenience factory that wires all sub-clients to a single HttpClient.
 */
export function createVideoCvClient(options: VideoCvClientOptions) {
  const { baseUrl, baseWsUrl = baseUrl.replace(/^http/, "ws") } = options;
  const http = new HttpClient(baseUrl);

  const getToken = () => (http as unknown as { token: string | null }).token;

  return {
    http,
    auth: new AuthClient(http),
    sessions: new SessionClient(http),
    profiles: new ProfileClient(http),
    search: new SearchClient(http),
    ws: new WsClient(baseWsUrl, getToken),
    setToken: (token: string | null) => http.setToken(token),
  };
}
