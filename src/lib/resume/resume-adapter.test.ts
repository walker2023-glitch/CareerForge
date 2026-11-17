import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createResumeAdapter } from './resume-adapter';
import { exampleResumeSuggestion as version } from '../../data/examples';
const row = {
  id: version.id, user_id: version.userId, job_id: version.jobId,
  generated_payload: { generatedBullets: version.generatedBullets, match: version.match },
  edited_bullets: version.editedBullets, fact_snapshot: version.factSnapshot,
  created_at: version.createdAt, updated_at: version.updatedAt,
};
function client(data: unknown) {
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), update: vi.fn(), insert: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })), single: vi.fn(async () => ({ data, error: null })),
  };
  for (const method of ['select', 'eq', 'order', 'update', 'insert'] as const) query[method].mockReturnValue(query);
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}
describe('résumé adapter privilege boundary (mock clients)', () => {
  it('uses the session and own-user filter for reads and edits, never the privileged writer', async () => {
    const session = client(row); const writer = client(row);
    const adapter = createResumeAdapter(session.client, version.userId, writer.client);
    expect((await adapter.getOwnResumeVersion(version.id))?.id).toBe(version.id);
    expect((await adapter.updateOwnResumeEditedBullets(version.id, version.editedBullets))?.editedBullets).toEqual(version.editedBullets);
    expect(session.query.eq).toHaveBeenCalledWith('user_id', version.userId);
    expect(session.query.update).toHaveBeenCalledWith({ edited_bullets: version.editedBullets });
    expect(writer.from).not.toHaveBeenCalled();
  });
  it('reauthorizes the job after generation and refuses to invoke the trusted writer on denial', async () => {
    const session = client(null); const writer = client(row);
    const adapter = createResumeAdapter(session.client, version.userId, writer.client);
    await expect(adapter.createResumeVersion({ jobId: version.jobId, generatedPayload: row.generated_payload, editedBullets: version.editedBullets, factSnapshot: version.factSnapshot })).rejects.toThrow('Job unavailable');
    expect(writer.from).not.toHaveBeenCalled();
  });
  it('uses server-derived ownership for the trusted insert', async () => {
    const session = client({ id: version.jobId }); const writer = client(row);
    const adapter = createResumeAdapter(session.client, version.userId, writer.client);
    expect((await adapter.createResumeVersion({ jobId: version.jobId, generatedPayload: row.generated_payload, editedBullets: version.editedBullets, factSnapshot: version.factSnapshot })).userId).toBe(version.userId);
    expect(writer.query.insert).toHaveBeenCalledWith({ user_id: version.userId, job_id: version.jobId, generated_payload: row.generated_payload, edited_bullets: version.editedBullets, fact_snapshot: version.factSnapshot });
    expect(session.query.insert).not.toHaveBeenCalled();
  });
});
