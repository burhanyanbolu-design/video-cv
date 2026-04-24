import type { ProfileSearchDocument } from "@video-cv/types";
import type { HttpClient } from "./http-client";

export interface SearchParams {
  skills?: string;
  title?: string;
  location?: string;
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  results: ProfileSearchDocument[];
  total: number;
  page: number;
  limit: number;
  message?: string; // present when results is empty
}

export class SearchClient {
  constructor(private readonly http: HttpClient) {}

  /** No authentication required */
  search(params: SearchParams = {}): Promise<SearchResponse> {
    const qs = new URLSearchParams();
    if (params.skills) qs.set("skills", params.skills);
    if (params.title) qs.set("title", params.title);
    if (params.location) qs.set("location", params.location);
    if (params.page !== undefined) qs.set("page", String(params.page));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));

    const query = qs.toString();
    return this.http.get<SearchResponse>(`/search${query ? `?${query}` : ""}`);
  }
}
