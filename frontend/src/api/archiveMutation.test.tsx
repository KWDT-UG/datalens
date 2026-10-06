import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BatchArchiveError, useArchiveRecordsMutation } from './queries';

vi.mock('../auth/AuthContext', () => ({
  useOptionalAuth: () => ({ user: { id: 5 } })
}));

describe('useArchiveRecordsMutation', () => {
  it('accounts for partial success and refreshes lists after the batch settles', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      if (init?.method === 'DELETE' && url.pathname.endsWith('/2/')) {
        return {
          json: async () => ({ errors: [{ detail: 'Archive blocked by an active member.' }] }),
          ok: false,
          status: 409
        } as Response;
      }
      return { json: async () => null, ok: true, status: 204 } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useArchiveRecordsMutation('members', '/api/v1/members/'),
      { wrapper }
    );

    let caught: unknown;
    try {
      await result.current.mutateAsync([1, 2]);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BatchArchiveError);
    expect((caught as BatchArchiveError).successfulIds).toEqual([1]);
    expect((caught as BatchArchiveError).failedIds).toEqual([2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['members'] }));
  });
});
