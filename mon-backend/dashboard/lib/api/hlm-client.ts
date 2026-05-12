import type {
  CreateHlmTicketPayload,
  HlmEntretienPreuveDto,
  HlmLogementDto,
  HlmLogementEntretienDto,
  HlmResidenceDto,
  HlmTicketDto,
  SubmitProofPayload,
} from "./hlm-types";
import { getAccessToken, getApiBaseUrl } from "@/lib/auth/token-storage";

/** Lit le JWT stocké (priorité : `token`, puis NEXT_PUBLIC_JWT_STORAGE_KEY / accessToken). */
export function getStoredJwt(): string | null {
  return getAccessToken();
}

export class HlmApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "HlmApiError";
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Client HTTP générique socle HLM (JWT Bearer). */
export async function hlmFetch<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean },
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new HlmApiError(
      "NEXT_PUBLIC_API_URL est absent — configurez l’URL du backend NestJS.",
      0,
    );
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const skipAuth = init?.skipAuth === true;
  if (!skipAuth) {
    const token = getStoredJwt();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const { skipAuth: _s, ...rest } = init ?? {};
  const res = await fetch(url, { ...rest, headers });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new HlmApiError(
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : res.statusText || `HTTP ${res.status}`,
      res.status,
      body,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await parseJsonSafe(res)) as T;
  return data;
}

export const hlmApi = {
  listResidences: () =>
    hlmFetch<HlmResidenceDto[]>("/hlm/residences"),

  getResidence: (id: string) =>
    hlmFetch<HlmResidenceDto>(`/hlm/residences/${encodeURIComponent(id)}`),

  listLogements: () =>
    hlmFetch<HlmLogementDto[]>("/hlm/logements"),

  getLogement: (id: string) =>
    hlmFetch<HlmLogementDto>(`/hlm/logements/${encodeURIComponent(id)}`),

  listLogementEntretien: (logementId: string) =>
    hlmFetch<HlmLogementEntretienDto[]>(
      `/hlm/entretien/logement/${encodeURIComponent(logementId)}`,
    ),

  listProofsForLogement: (logementId: string) =>
    hlmFetch<HlmEntretienPreuveDto[]>(
      `/hlm/preuves/logement/${encodeURIComponent(logementId)}`,
    ),

  submitProof: (logementEntretienId: string, payload: SubmitProofPayload) =>
    hlmFetch<HlmEntretienPreuveDto>(
      `/hlm/preuves/${encodeURIComponent(logementEntretienId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),

  listTickets: () => hlmFetch<HlmTicketDto[]>("/hlm/tickets"),

  createTicket: (payload: CreateHlmTicketPayload) =>
    hlmFetch<HlmTicketDto>("/hlm/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
