import type { ApiErrorItem, PaginatedResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const UNAUTHORIZED_EVENT = 'datalens:unauthorized';

function getCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : '';
}

export class ApiClientError extends Error {
  status: number;
  errors: ApiErrorItem[];
  payload: unknown;

  constructor(
    message: string,
    status: number,
    errors: ApiErrorItem[] = [],
    payload: unknown = null
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
    this.payload = payload;
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

export async function apiGetAllPages<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const response = await apiGet<PaginatedResponse<T>>(path, {
      ...params,
      page,
      page_size: 200
    });
    results.push(...response.results);

    if (!response.next) {
      return results;
    }
    page += 1;
  }
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
  const csrfToken = getCookie('csrftoken');
  const response = await fetch(buildUrl(path, params), {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(method === 'GET' || !csrfToken ? {} : { 'X-CSRFToken': csrfToken }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const errors = extractErrors(payload);
    const message = errors[0]?.detail ?? `Request failed with status ${response.status}`;
    throw new ApiClientError(message, response.status, errors, payload);
  }

  return payload as T;
}

export async function apiPost<T, TBody>(path: string, body: TBody): Promise<T> {
  return apiRequest<T, TBody>(path, { body, method: 'POST' });
}

export async function initializeCsrf(): Promise<void> {
  await apiGet('/api/v1/auth/csrf/');
}

export async function apiPatch<T, TBody>(path: string, body: TBody): Promise<T> {
  return apiRequest<T, TBody>(path, { body, method: 'PATCH' });
}

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' });
}
