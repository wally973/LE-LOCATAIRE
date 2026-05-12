import { clearAuthTokens, getApiBaseUrl, setAuthTokens } from "@/lib/auth/token-storage";

export type AuthUser = {
  id: number;
  email?: string | null;
  phone?: string;
  role: string;
};

export type LoginResponse = {
  user: AuthUser;
  token?: string;
  access_token?: string;
  refresh_token?: string;
};

async function parseJson(res: Response): Promise<unknown> {
  const t = await res.text();
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return t;
  }
}

export async function authLogin(
  body: { email?: string; phone?: string; password: string },
): Promise<LoginResponse> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquant");

  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await parseJson(res)) as LoginResponse & {
    message?: string | string[];
  };

  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : Array.isArray(data.message)
          ? data.message.join(", ")
          : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const access = data.token ?? data.access_token;
  if (!access || !data.refresh_token) {
    throw new Error("Réponse auth incomplète");
  }

  setAuthTokens(access, data.refresh_token);
  return data;
}

export async function authRefresh(refreshToken: string): Promise<LoginResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = (await parseJson(res)) as LoginResponse;
  if (!res.ok) throw new Error("Session expirée — reconnectez-vous");
  const access = data.token ?? data.access_token;
  if (access && data.refresh_token) {
    setAuthTokens(access, data.refresh_token);
  }
  return data;
}

export async function authMe(accessToken: string): Promise<AuthUser> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const data = (await parseJson(res)) as AuthUser & { message?: unknown };
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Session invalide",
    );
  }

  const normalized: AuthUser = {
    id: (data as { id?: number }).id ?? (data as { userId?: number }).userId!,
    email: (data as { email?: string | null }).email,
    phone: (data as { phone?: string }).phone,
    role: (data as { role: string }).role,
  };

  if (!normalized.role || normalized.id == null) {
    throw new Error("Réponse /auth/me invalide");
  }

  return normalized;
}

export { clearAuthTokens };
