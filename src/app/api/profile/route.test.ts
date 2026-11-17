import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { exampleStudent } from '../../../data/examples';
vi.mock('../../../lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
const rpc = vi.fn();
const getUser = vi.fn();
const payload = { displayName: 'Fictional Student', field: null, facts: [], expectedUpdatedAt: '2026-11-17T20:00:00.123456Z' };
const request = (body: unknown) => new Request('http://localhost/api/profile', { method: 'PATCH', body: JSON.stringify(body) });
beforeEach(() => {
  rpc.mockReset(); getUser.mockResolvedValue({ data: { user: { id: exampleStudent.userId } }, error: null });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser }, rpc } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
});
describe('atomic profile HTTP boundary (mock RPC)', () => {
  it('uses one RPC and passes the full version unchanged', async () => {
    rpc.mockResolvedValue({ data: { ...exampleStudent, updatedAt: '2026-11-17T20:00:00.123457Z' }, error: null });
    const res = await PATCH(request({ ...payload, userId: 'ignored' }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_student_profile', { p_expected_updated_at: payload.expectedUpdatedAt, p_display_name: payload.displayName, p_field: null, p_facts: [] });
    expect((await res.json()).data.updatedAt).toBe('2026-11-17T20:00:00.123457Z');
  });
  it('maps the database stale-write result to a conflict', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    expect((await PATCH(request(payload))).status).toBe(409);
  });
  it('denies signed out requests before calling RPC', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await PATCH(request(payload))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rejects duplicate IDs and malformed JSON without writes', async () => {
    const fact = exampleStudent.facts[0];
    expect((await PATCH(request({ ...payload, facts: [fact, fact] }))).status).toBe(400);
    expect((await PATCH(new Request('http://localhost/api/profile', { method: 'PATCH', body: '{' }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not expose database errors or report failed saves as saved', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'private content' } });
    const res = await PATCH(request(payload));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('private content');
  });
});
