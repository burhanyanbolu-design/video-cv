import type { Profile, CV_Data, ProfileVisibility } from "@video-cv/types";
import type { HttpClient } from "./http-client";

export interface UpdateProfilePayload {
  cvData?: CV_Data;
  visibility?: ProfileVisibility;
}

export class ProfileClient {
  constructor(private readonly http: HttpClient) {}

  /** Public — no auth required */
  get(profileId: string): Promise<Profile> {
    return this.http.get<Profile>(`/profiles/${profileId}`);
  }

  update(profileId: string, payload: UpdateProfilePayload): Promise<Profile> {
    return this.http.patch<Profile>(`/profiles/${profileId}`, payload);
  }

  delete(profileId: string): Promise<void> {
    return this.http.delete<void>(`/profiles/${profileId}`);
  }
}
