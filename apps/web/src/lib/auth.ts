import Cookies from "js-cookie";
import type { User } from "@video-cv/types";

const TOKEN_COOKIE = "vcv_token";
const USER_KEY = "vcv_user";

export function getToken(): string | null {
  return Cookies.get(TOKEN_COOKIE) ?? null;
}

export function setToken(token: string): void {
  // 7-day expiry; httpOnly is set server-side via the API route
  Cookies.set(TOKEN_COOKIE, token, { expires: 7, sameSite: "lax" });
}

export function clearToken(): void {
  Cookies.remove(TOKEN_COOKIE);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(USER_KEY);
  }
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: User): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
