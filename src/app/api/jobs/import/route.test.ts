import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { MAX_RAW_BODY_BYTES } from '../../../../lib/jobs/read-bounded-body';

// Mock Supabase server client so route tests can simulate both signed-out and signed-in states
vi.mock('../../../../lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '../../../../lib/supabase/server';

function createPostRequest(
  body: string | Uint8Array,
  headers: Record<string, string> = {},
): NextRequest {
  const reqInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    duplex: 'half',
    body,
  };

  return new NextRequest(
    'http://localhost:3000/api/jobs/import',
    reqInit as unknown as ConstructorParameters<typeof NextRequest>[1],
  );
}

const validPayload = JSON.stringify({
  title: 'Junior Web Developer',
  company: 'North Star Labs',
  description: 'Build accessible interfaces.',
  location: 'Rexburg, ID',
  jobType: 'full_time',
  workMode: 'on_site',
  sourceUrl: 'https://example.com/jobs/001',
  deadline: '2026-12-01',
});

describe('POST /api/jobs/import', () => {
  it('returns 401 UNAUTHENTICATED when caller is signed out', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createPostRequest(validPayload);
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  });

  it('returns 413 PAYLOAD_TOO_LARGE when Content-Length exceeds raw byte limit', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createPostRequest(validPayload, {
      'content-length': String(MAX_RAW_BODY_BYTES + 1),
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    const json = await response.json();
    expect(json.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 400 INVALID_INPUT for empty request body', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createPostRequest('   ');
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_INPUT');
    expect(json.error.message).toContain('empty');
  });

  it('returns 400 INVALID_INPUT for malformed JSON body', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createPostRequest('{ broken json');
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_INPUT');
    expect(json.error.message).toContain('valid JSON');
  });

  it('returns 400 INVALID_INPUT for schema violation (missing title)', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const invalid = JSON.stringify({
      company: 'North Star Labs',
      description: 'Build accessible interfaces.',
    });

    const request = createPostRequest(invalid);
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('returns a safe 503 if the database write fails', async () => {
    // The mocked session has no usable database client.
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const request = createPostRequest(validPayload);
    const response = await POST(request);

    // Must be fail-closed 503, never pretending to save or returning fake 200
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(json.error.message).toMatch(/Unable to (import|load) job/);
  });
});
