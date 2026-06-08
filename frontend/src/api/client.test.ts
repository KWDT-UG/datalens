import { describe, expect, it } from 'vitest';

import { installCrudFetchMock } from '../test/mockApi';
import { apiGet, apiPatch, apiPost } from './client';
import type { PaginatedResponse } from './types';

const entityPaths = [
  '/api/v1/communities/',
  '/api/v1/groups/',
  '/api/v1/members/',
  '/api/v1/institutions/',
  '/api/v1/committees/',
  '/api/v1/cooperatives/',
  '/api/v1/resources/',
  '/api/v1/impact-records/'
];

describe.each(entityPaths)('%s API client contract', (path) => {
  it('supports list, create, and partial update requests', async () => {
    const fetchMock = installCrudFetchMock();

    await apiGet<PaginatedResponse<Record<string, unknown>>>(path, { page: 1 });
    await apiPost<Record<string, unknown>, { name: string }>(path, {
      name: 'Created record'
    });
    await apiPatch<Record<string, unknown>, { name: string }>(`${path}7/`, {
      name: 'Updated record'
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`${path}?page=1`),
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(path),
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(`${path}7/`),
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});

describe('browser authentication transport', () => {
  it('sends cookies and CSRF without an Authorization token', async () => {
    const fetchMock = installCrudFetchMock();
    document.cookie = 'csrftoken=test-csrf-token';

    await apiPost('/api/v1/auth/logout/', {});

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/logout/'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'X-CSRFToken': 'test-csrf-token'
        })
      })
    );
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.headers).not.toHaveProperty('Authorization');
  });
});
