import { describe, expect, it, vi } from 'vitest';
import { createJobDependencies } from './job-adapter';
import { createSupabaseServerClient } from '../supabase/server';
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));

describe('session-scoped job adapter (mock database)', () => {
  it('derives private provenance from verified auth, and maps the stored row', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const draft = { title: 'Intern', company: 'Fictional', description: 'Build software.', location: null, jobType: 'internship' as const, workMode: 'remote' as const, sourceUrl: null, deadline: null };
    const insert = vi.fn();
    const single = vi.fn().mockResolvedValue({ data: {
      ...draft, id, job_type: draft.jobType, work_mode: draft.workMode,
      source_url: null, source: 'pasted', status: 'private', created_by_user_id: id,
      provider_name: null, external_id: null, employer_id: null, retrieved_at: null,
      deadline_verified: false, created_at: '2026-11-17T00:00:00Z', updated_at: '2026-11-17T00:00:00Z',
    }, error: null });
    insert.mockReturnValue({ select: () => ({ single }) });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
      from: () => ({ insert }),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    const deps = await createJobDependencies();
    const saved = await deps.adapter!.createPrivateJobImport(draft);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ created_by_user_id: id, status: 'private', source: 'pasted', deadline_verified: false, verification_status: 'unverified' }));
    expect(saved.id).toBe(id);
  });
  it('provides no data adapter when authentication fails', async () => {
    vi.mocked(createSupabaseServerClient).mockRejectedValue(new Error('Unavailable'));
    const deps = await createJobDependencies();
    expect(await deps.getUser()).toBeNull();
    expect(deps.adapter).toBeUndefined();
  });
});
