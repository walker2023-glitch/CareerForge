import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

vi.mock('../../../../lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const mockJobId = '22222222-2222-4222-8222-222222222222';

function createGetRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/jobs/${id}`, {
    method: 'GET',
  });
}

describe('GET /api/jobs/[id]', () => {
  it('returns 401 UNAUTHENTICATED when caller is signed out', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createGetRequest(mockJobId);
    const response = await GET(request, { params: Promise.resolve({ id: mockJobId }) });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  });

  it('returns 404 NOT_FOUND for malformed UUID format', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createGetRequest('invalid-uuid-123');
    const response = await GET(request, { params: Promise.resolve({ id: 'invalid-uuid-123' }) });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({
      error: { code: 'NOT_FOUND', message: 'Job not found' },
    });
  });

  it('returns a safe 503 if the database read fails', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createGetRequest(mockJobId);
    const response = await GET(request, { params: Promise.resolve({ id: mockJobId }) });

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(json.error.message).toMatch(/Unable to (import|load) job/);
  });
});
