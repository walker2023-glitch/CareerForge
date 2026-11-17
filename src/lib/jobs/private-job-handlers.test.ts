import { describe, expect, it, vi } from 'vitest';
import { handleImportJob, handleGetJob } from './private-job-handlers';
import type { JobDraft, JobPosting } from '../../contracts';
import { MAX_RAW_BODY_BYTES } from './read-bounded-body';

const mockStudentId = '11111111-1111-4111-8111-111111111111';
const foreignStudentId = '99999999-9999-4999-8999-999999999999';
const mockJobId = '22222222-2222-4222-8222-222222222222';

const validDraft: JobDraft = {
  title: 'Frontend Engineer Intern',
  company: 'Rexburg Tech Solutions',
  description: 'Develop responsive React and TypeScript user interfaces.',
  location: 'Rexburg, ID',
  jobType: 'internship',
  workMode: 'hybrid',
  sourceUrl: 'https://example.com/careers/intern-101',
  deadline: '2026-12-15',
};

function createMockRequest(body: unknown, options: { headers?: Record<string, string> } = {}): Request {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = new Headers(options.headers || { 'Content-Type': 'application/json' });
  return new Request('http://localhost:3000/api/jobs/import', {
    method: 'POST',
    headers,
    body: json,
  });
}

describe('handleImportJob (POST /api/jobs/import)', () => {
  it('rejects signed-out requests with 401 UNAUTHENTICATED', async () => {
    const req = createMockRequest(validDraft);
    const res = await handleImportJob(req, {
      getUser: async () => null,
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  });

  it('rejects empty request body with 400 INVALID_INPUT', async () => {
    const req = new Request('http://localhost:3000/api/jobs/import', {
      method: 'POST',
      body: '   ',
    });
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(data.error.message).toContain('empty');
  });

  it('rejects malformed JSON body with 400 INVALID_INPUT', async () => {
    const req = new Request('http://localhost:3000/api/jobs/import', {
      method: 'POST',
      body: '{ title: broken json',
    });
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(data.error.message).toContain('valid JSON');
  });

  it('rejects draft missing required title with 400 INVALID_INPUT', async () => {
    const invalid = { ...validDraft, title: '' };
    const req = createMockRequest(invalid);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(data.error.message).toContain('title');
  });

  it('rejects draft missing required company with 400 INVALID_INPUT', async () => {
    const invalid = { ...validDraft, company: '' };
    const req = createMockRequest(invalid);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects non-https sourceUrl with 400 INVALID_INPUT', async () => {
    const invalid = { ...validDraft, sourceUrl: 'http://insecure.example.com' };
    const req = createMockRequest(invalid);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects oversized request body with 413 PAYLOAD_TOO_LARGE', async () => {
    // Generate an oversized payload exceeding MAX_RAW_BODY_BYTES (100 KB)
    const giantDescription = 'X'.repeat(MAX_RAW_BODY_BYTES + 500);
    const giantPayload = JSON.stringify({ ...validDraft, description: giantDescription });

    const req = new Request('http://localhost:3000/api/jobs/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(giantPayload.length),
      },
      body: giantPayload,
    });

    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
    });

    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('fails closed with 503 SERVICE_UNAVAILABLE when adapter is absent (no mock persistence)', async () => {
    const req = createMockRequest(validDraft);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: {}, // No adapter provided
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(data.error.message).toContain('adapter is not available');
  });

  it('successfully persists private job and returns 200 with server-derived fields', async () => {
    const now = new Date().toISOString();
    const mockCreatedPosting: JobPosting = {
      ...validDraft,
      id: mockJobId,
      source: 'pasted',
      providerName: null,
      externalId: null,
      createdByUserId: mockStudentId,
      employerId: null,
      status: 'private',
      retrievedAt: null,
      deadlineVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    const createPrivateJobImport = vi.fn().mockResolvedValue(mockCreatedPosting);

    const req = createMockRequest(validDraft);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { createPrivateJobImport },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual(mockCreatedPosting);
    expect(data.data.source).toBe('pasted');
    expect(data.data.status).toBe('private');
    expect(data.data.createdByUserId).toBe(mockStudentId);
    expect(data.data.deadlineVerified).toBe(false);
    expect(createPrivateJobImport).toHaveBeenCalledWith(validDraft);
  });

  it('returns 503 SERVICE_UNAVAILABLE if adapter throws database error', async () => {
    const createPrivateJobImport = vi.fn().mockRejectedValue(new Error('Database connection failed'));

    const req = createMockRequest(validDraft);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { createPrivateJobImport },
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(data.error.message).toBe('Unable to import job');
  });

  it('returns 503 if adapter returns malformed data violating contract schema', async () => {
    const malformed = { ...validDraft, id: 'not-a-uuid' };
    const createPrivateJobImport = vi.fn().mockResolvedValue(malformed as unknown as JobPosting);

    const req = createMockRequest(validDraft);
    const res = await handleImportJob(req, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { createPrivateJobImport },
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(data.error.message).toContain('malformed');
  });
});

describe('handleGetJob (GET /api/jobs/[id])', () => {
  it('rejects signed-out requests with 401 UNAUTHENTICATED', async () => {
    const res = await handleGetJob(mockJobId, {
      getUser: async () => null,
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects malformed UUID parameter with 404 NOT_FOUND', async () => {
    const res = await handleGetJob('not-a-valid-uuid-123', {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { getAuthorizedJob: vi.fn() },
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('NOT_FOUND');
    expect(data.error.message).toBe('Job not found');
  });

  it('fails closed with 503 when adapter is absent', async () => {
    const res = await handleGetJob(mockJobId, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: {},
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns 404 NOT_FOUND for non-existent job', async () => {
    const getAuthorizedJob = vi.fn().mockResolvedValue(null);

    const res = await handleGetJob(mockJobId, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { getAuthorizedJob },
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('NOT_FOUND');
    expect(data.error.message).toBe('Job not found');
  });

  it('returns indistinguishable 404 NOT_FOUND for foreign private job', async () => {
    // Under RLS, getAuthorizedJob returns null when another user's private job is requested
    const getAuthorizedJob = vi.fn().mockImplementation(async (id: string) => {
      // Simulating RLS behavior: only caller's jobs or published employer jobs return data
      return null;
    });

    const res = await handleGetJob(mockJobId, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { getAuthorizedJob },
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('NOT_FOUND');
    expect(data.error.message).toBe('Job not found');
  });

  it('returns 200 with JobPosting for owner reading their own private job', async () => {
    const ownJob: JobPosting = {
      ...validDraft,
      id: mockJobId,
      source: 'pasted',
      providerName: null,
      externalId: null,
      createdByUserId: mockStudentId,
      employerId: null,
      status: 'private',
      retrievedAt: null,
      deadlineVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getAuthorizedJob = vi.fn().mockResolvedValue(ownJob);

    const res = await handleGetJob(mockJobId, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { getAuthorizedJob },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual(ownJob);
    expect(data.data.createdByUserId).toBe(mockStudentId);
    expect(data.data.status).toBe('private');
  });

  it('returns 200 with JobPosting for student reading a published employer job', async () => {
    const publishedEmployerJob: JobPosting = {
      ...validDraft,
      id: mockJobId,
      source: 'employer',
      providerName: null,
      externalId: null,
      createdByUserId: foreignStudentId,
      employerId: '77777777-7777-4777-8777-777777777777',
      status: 'published',
      retrievedAt: null,
      deadlineVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getAuthorizedJob = vi.fn().mockResolvedValue(publishedEmployerJob);

    const res = await handleGetJob(mockJobId, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { getAuthorizedJob },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toEqual(publishedEmployerJob);
    expect(data.data.status).toBe('published');
    expect(data.data.source).toBe('employer');
  });

  it('returns 503 SERVICE_UNAVAILABLE if adapter throws an error', async () => {
    const getAuthorizedJob = vi.fn().mockRejectedValue(new Error('Connection timeout'));

    const res = await handleGetJob(mockJobId, {
      getUser: async () => ({ id: mockStudentId }),
      adapter: { getAuthorizedJob },
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(data.error.message).toBe('Unable to load job');
  });
});

it('reports unavailable infrastructure distinctly from signed-out auth', async () => {
  const response = await handleImportJob(new Request('http://localhost/api/jobs/import', { method: 'POST', body: '{}' }), { unavailable: true });
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
});
