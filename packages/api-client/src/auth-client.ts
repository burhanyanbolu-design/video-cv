import type { User } from "@video-cv/types";
import type { HttpClient } from "./http-client";

export interface RegisterPayload {
  email: string;
  password: string;
  privacyPolicyVersion: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export class AuthClient {
  constructor(private readonly http: HttpClient) {}

  register(payload: RegisterPayload): Promise<AuthResponse> {
    return this.http.post<AuthResponse>("/auth/register", payload);
  }

  login(payload: LoginPayload): Promise<AuthResponse> {
    return this.http.post<AuthResponse>("/auth/login", payload);
  }

  logout(): Promise<void> {
    return this.http.post<void>("/auth/logout");
  }

  deleteAccount(): Promise<void> {
    return this.http.delete<void>("/auth/account");
  }
}
