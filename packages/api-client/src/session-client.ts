import type { Session } from "@video-cv/types";
import type { HttpClient } from "./http-client";

export interface CreateSessionResponse {
  sessionId: string;
  uploadUrl: string; // pre-signed S3 URL for raw video upload
}

export class SessionClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new session and receive a pre-signed upload URL for the raw video.
   * The caller should PUT the video file directly to `uploadUrl`.
   */
  create(): Promise<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>("/sessions");
  }

  list(): Promise<Session[]> {
    return this.http.get<Session[]>("/sessions");
  }

  get(sessionId: string): Promise<Session> {
    return this.http.get<Session>(`/sessions/${sessionId}`);
  }

  delete(sessionId: string): Promise<void> {
    return this.http.delete<void>(`/sessions/${sessionId}`);
  }

  getPipelineStatus(sessionId: string): Promise<Pick<Session, "status">> {
    return this.http.get<Pick<Session, "status">>(`/sessions/${sessionId}/status`);
  }
}
