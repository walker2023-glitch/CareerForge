import { afterEach, expect, it, vi } from 'vitest';
import { createModelCaller } from './model-caller';
afterEach(() => vi.unstubAllEnvs());
it('requires both an explicit model and server API key', () => {
  vi.stubEnv('ANTHROPIC_API_KEY', ''); vi.stubEnv('CLAUDE_MODEL', '');
  expect(createModelCaller()).toBeUndefined();
});
it('handles a valid bounded provider response without exposing credentials', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'unit-test-placeholder'); vi.stubEnv('CLAUDE_MODEL', 'explicit-test-model');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] })));
  expect(await createModelCaller(fetcher)!({ system: 'instructions', userMessage: 'fictional facts' })).toEqual({ ok: true, content: '{}' });
  expect(fetcher).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }));
});
it('fails safely on provider failure and truncated output', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'unit-test-placeholder'); vi.stubEnv('CLAUDE_MODEL', 'explicit-test-model');
  for (const response of [new Response('private diagnostic', { status: 500 }), new Response(JSON.stringify({ stop_reason: 'max_tokens', content: [] }))]) {
    const result = await createModelCaller(vi.fn().mockResolvedValue(response))!({ system: 's', userMessage: 'u' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private diagnostic');
  }
});
