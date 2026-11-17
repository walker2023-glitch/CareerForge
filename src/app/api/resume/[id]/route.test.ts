import { describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';
import { NextRequest } from 'next/server';

vi.mock('../../../../lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const mockResumeId = '55555555-5555-4555-8555-555555555555';

function signedInClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValueOnce({
        data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        error: null,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>;
}

describe('GET/PATCH /api/resume/[id]', () => {
  it('GET returns 401 UNAUTHENTICATED when caller is signed out', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const response = await GET(new NextRequest(`http://localhost:3000/api/resume/${mockResumeId}`), {
      params: Promise.resolve({ id: mockResumeId }),
    });
    expect(response.status).toBe(401);
  });

  it('GET returns safe 503 when the database operation fails', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(signedInClient());

    const response = await GET(new NextRequest(`http://localhost:3000/api/resume/${mockResumeId}`), {
      params: Promise.resolve({ id: mockResumeId }),
    });
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(json.error.message).toMatch(/Unable to (load|update) resume version/);
  });

  it('PATCH returns safe 503 when the database operation fails', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(signedInClient());

    const request = new NextRequest(`http://localhost:3000/api/resume/${mockResumeId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      duplex: 'half',
      body: JSON.stringify({
        editedBullets: [{ id: '66666666-6666-4666-8666-666666666666', text: 'Edited' }],
      }),
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);

    const response = await PATCH(request, {
      params: Promise.resolve({ id: mockResumeId }),
    });
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(json.error.message).toMatch(/Unable to (load|update) resume version/);
  });
});
