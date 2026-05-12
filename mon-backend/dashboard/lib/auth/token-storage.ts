const KEY_ACCESS = "token";
const KEY_REFRESH = "refresh_token";

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(KEY_ACCESS) ??
    window.localStorage.getItem(
      process.env.NEXT_PUBLIC_JWT_STORAGE_KEY ?? "accessToken",
    )
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_REFRESH);
}

export function setAuthTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ACCESS, access);
  window.localStorage.setItem(KEY_REFRESH, refresh);
  window.localStorage.setItem("accessToken", access);
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_ACCESS);
  window.localStorage.removeItem(KEY_REFRESH);
  window.localStorage.removeItem("accessToken");
  const k = process.env.NEXT_PUBLIC_JWT_STORAGE_KEY;
  if (k) window.localStorage.removeItem(k);
}
