import type { ApiErrorItem } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const AUTH_TOKEN_KEY = 'datalens.authToken';
export const UNAUTHORIZED_EVENT = 'datalens:unauthorized';

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export class ApiClientError extends Error {
  status: number;
  errors: ApiErrorItem[];

  constructor(message: string, status: number, errors: ApiErrorItem[] = []) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function extractErrors(payload: unknown): ApiErrorItem[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const maybeErrors = (payload as { errors?: unknown }).errors;
  if (!Array.isArray(maybeErrors)) {
    return [];
  }

  return maybeErrors
    .filter((item): item is ApiErrorItem => {
      return Boolean(item && typeof item === 'object' && 'detail' in item);
    })
    .map((item) => ({
      attr: item.attr,
      detail: String(item.detail),
      code: item.code
    }));
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  return apiRequest<T>(path, { params });
}

type ApiRequestOptions<TBody> = {
  body?: TBody;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | undefined>;
};

async function apiRequest<T, TBody = never>(
  path: string,
  { body, method = 'GET', params }: ApiRequestOptions<TBody>
): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const errors = extractErrors(payload);
    const message = errors[0]?.detail ?? `Request failed with status ${response.status}`;
    throw new ApiClientError(message, response.status, errors);
  }

  return payload as T;
}

export async function apiPost<T, TBody>(path: string, body: TBody): Promise<T> {
  return apiRequest<T, TBody>(path, { body, method: 'POST' });
}

export async function apiPatch<T, TBody>(path: string, body: TBody): Promise<T> {
  return apiRequest<T, TBody>(path, { body, method: 'PATCH' });
}

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' });
}
