import type { SessionStatus } from "./session";
import type { ProfileVisibility } from "./profile";
import type { CV_Data } from "./cv-data";

// ---------------------------------------------------------------------------
// Pipeline events (emitted per session, keyed by userId channel)
// ---------------------------------------------------------------------------

export interface PipelineProgressEvent {
  type: "pipeline:progress";
  sessionId: string;
  stage: SessionStatus;
  /** 0–100 */
  percentage: number;
}

export interface PipelineCompleteEvent {
  type: "pipeline:complete";
  sessionId: string;
  profileUrl: string;
}

export interface PipelineErrorEvent {
  type: "pipeline:error";
  sessionId: string;
  stage: SessionStatus;
  message: string;
}

// ---------------------------------------------------------------------------
// Session events
// ---------------------------------------------------------------------------

export interface SessionUpdatedEvent {
  type: "session:updated";
  sessionId: string;
  cvData: CV_Data;
}

// ---------------------------------------------------------------------------
// Profile events
// ---------------------------------------------------------------------------

export interface ProfileVisibilityChangedEvent {
  type: "profile:visibility_changed";
  profileId: string;
  visibility: ProfileVisibility;
}

// ---------------------------------------------------------------------------
// Union type for all WebSocket events
// ---------------------------------------------------------------------------

export type WebSocketEvent =
  | PipelineProgressEvent
  | PipelineCompleteEvent
  | PipelineErrorEvent
  | SessionUpdatedEvent
  | ProfileVisibilityChangedEvent;
