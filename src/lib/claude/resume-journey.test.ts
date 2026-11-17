import { expect, it, vi } from 'vitest';
import type { ResumeDataAdapter } from './resume-handlers';
import { handleSuggestResume } from './resume-handlers';
import { generateResumeSuggestions } from './resume-suggest';
import { exampleJob, exampleStudent } from '../../data/examples';
const fact = exampleStudent.facts[0];
const modelCaller = vi.fn(async () => ({ ok: true as const, content: JSON.stringify({ matches: [], gaps: [], suggestedBullets: [{ text: 'Managed an international engineering organization.', evidence: [fact.id], targetsRequirement: 'Project experience' }] }) }));
const req = () => new Request('http://localhost/api/resume/suggest', { method: 'POST', body: JSON.stringify({ jobId: exampleJob.id, userId: 'ignored', facts: [{ text: 'invented client facts' }] }) });
it('uses real supplied facts verbatim even when the model invents a nonnumeric achievement', async () => {
  const result = await generateResumeSuggestions({ userId: exampleStudent.userId, job: exampleJob, facts: [fact], modelCaller });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.version.generatedBullets[0]).toMatchObject({ text: fact.text, evidence: [fact.id] });
});
it('authorizes the job before loading facts or invoking the model', async () => {
  const getStudentFacts = vi.fn(); const createResumeVersion = vi.fn(); const provider = vi.fn();
  const response = await handleSuggestResume(req(), { getUser: async () => ({ id: exampleStudent.userId }), modelCaller: provider,
    adapter: { getAuthorizedJob: async () => null, getStudentFacts, createResumeVersion } });
  expect(response.status).toBe(404);
  expect(getStudentFacts).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled(); expect(createResumeVersion).not.toHaveBeenCalled();
});
it('fails without evidence before invoking the model or saving', async () => {
  const provider = vi.fn(); const save = vi.fn();
  const response = await handleSuggestResume(req(), { getUser: async () => ({ id: exampleStudent.userId }), modelCaller: provider,
    adapter: { getAuthorizedJob: async () => exampleJob, getStudentFacts: async () => [], createResumeVersion: save } });
  expect(response.status).toBe(400); expect(provider).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
it('returns only the database-saved version and never substitutes client facts', async () => {
  const save = vi.fn(async (input: Parameters<ResumeDataAdapter['createResumeVersion']>[0]) => ({ id: crypto.randomUUID(), userId: exampleStudent.userId, jobId: exampleJob.id, ...input.generatedPayload, editedBullets: input.editedBullets, factSnapshot: input.factSnapshot, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  const response = await handleSuggestResume(req(), { getUser: async () => ({ id: exampleStudent.userId }), modelCaller,
    adapter: { getAuthorizedJob: async () => exampleJob, getStudentFacts: async () => [fact], createResumeVersion: save } });
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.data.factSnapshot).toEqual([fact]); expect(body.data.generatedBullets[0].text).toBe(fact.text);
});
