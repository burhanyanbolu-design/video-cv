import type { CV_Data } from "./cv-data";

export type SessionStatus =
  | "pending"
  | "transcribing"
  | "cleaning"
  | "extracting"
  | "building"
  | "processing"
  | "complete"
  | "error";

/** A single recording and processing workflow from start to published Profile. */
export interface Session {
  id: string; // UUID
  userId: string; // UUID FK → User
  status: SessionStatus;
  rawVideoUrl: string | null;
  cleanVideoUrl: string | null;
  /** Time-stamped transcript: array of { word, startMs, endMs } */
  transcript: TranscriptWord[] | null;
  cvData: CV_Data | null;
  profileId: string | null; // UUID FK → Profile
  createdAt: string; // ISO 8601
}

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}
