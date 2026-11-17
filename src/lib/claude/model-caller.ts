import { z } from 'zod';
import type { ModelCaller } from './resume-suggest';
import { readBoundedBody } from '../jobs/read-bounded-body';

/** Server-only provider boundary. Never logs prompts, account data or credentials. */
export function createModelCaller(fetcher: typeof fetch = fetch): ModelCaller | undefined {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL;
  if (!key || !model) return undefined;
  return async ({ system, userMessage }) => {
    try {
      const response = await fetcher('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 6000, system, messages: [{ role: 'user', content: userMessage }] }),
      });
      if (!response.ok) return { ok: false, error: 'Suggestion provider unavailable' };
      const bounded = await readBoundedBody(response, 100_000);
      if (!bounded.ok) return { ok: false, error: 'Suggestion response too large' };
      const parsed = z.object({
        stop_reason: z.literal('end_turn'),
        content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
      }).safeParse(JSON.parse(bounded.text));
      if (!parsed.success) return { ok: false, error: 'Invalid suggestion response' };
      return { ok: true, content: parsed.data.content.map(c => c.text).join('') };
    } catch {
      return { ok: false, error: 'Suggestion provider unavailable' };
    }
  };
}
