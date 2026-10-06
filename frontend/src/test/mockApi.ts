import { vi } from 'vitest';

type JsonValue = Record<string, unknown> | unknown[];

export function jsonResponse(body: JsonValue, status = 200) {
  return Promise.resolve({
    json: async () => body,
    ok: status >= 200 && status < 300,
    status
  } as Response);
}

export function installCrudFetchMock(options?: {
  communities?: object[];
  committees?: object[];
  cooperatives?: object[];
  groups?: object[];
  institutions?: object[];
  members?: object[];
  programs?: object[];
  resourceCategories?: object[];
  resources?: object[];
  thematicAreas?: object[];
}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input), window.location.origin);
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url.pathname === '/api/v1/communities/') {
        return jsonResponse({
          count: options?.communities?.length ?? 0,
          next: null,
          previous: null,
          results: options?.communities ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/groups/') {
        return jsonResponse({
          count: options?.groups?.length ?? 0,
          next: null,
          previous: null,
          results: options?.groups ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/committees/') {
        return jsonResponse({
          count: options?.committees?.length ?? 0,
          next: null,
          previous: null,
          results: options?.committees ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/cooperatives/') {
        return jsonResponse({
          count: options?.cooperatives?.length ?? 0,
          next: null,
          previous: null,
          results: options?.cooperatives ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/institutions/') {
        return jsonResponse({
          count: options?.institutions?.length ?? 0,
          next: null,
          previous: null,
          results: options?.institutions ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/members/') {
        return jsonResponse({
          count: options?.members?.length ?? 0,
          next: null,
          previous: null,
          results: options?.members ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/resources/') {
        return jsonResponse({
          count: options?.resources?.length ?? 0,
          next: null,
          previous: null,
          results: options?.resources ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/thematic-areas/') {
        return jsonResponse({
          count: options?.thematicAreas?.length ?? 0,
          next: null,
          previous: null,
          results: options?.thematicAreas ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/programs/') {
        return jsonResponse({
          count: options?.programs?.length ?? 0,
          next: null,
          previous: null,
          results: options?.programs ?? []
        });
      }

      if (method === 'GET' && url.pathname === '/api/v1/resource-categories/') {
        return jsonResponse({
          count: options?.resourceCategories?.length ?? 0,
          next: null,
          previous: null,
          results: options?.resourceCategories ?? []
        });
      }

      if (method === 'GET') {
        return jsonResponse({ count: 0, next: null, previous: null, results: [] });
      }

      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return jsonResponse({ id: 99, ...body }, method === 'POST' ? 201 : 200);
    }
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function mutationCall(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.find(([, init]) =>
    ['POST', 'PATCH'].includes(init?.method ?? '')
  );
  if (!call) {
    throw new Error('Expected a POST or PATCH request.');
  }
  return {
    body: JSON.parse(String(call[1]?.body)),
    method: call[1]?.method,
    path: new URL(String(call[0]), window.location.origin).pathname
  };
}
