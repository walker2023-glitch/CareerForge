'use client';
import { useState } from 'react';
import { ResumeVersionSchema, type ResumeVersion, type JobPosting } from '../../../contracts';
import { MatchReview } from './MatchReview';

export function LiveMatch({ job, initialResume, configured }: { job: JobPosting; initialResume: ResumeVersion | null; configured: boolean }) {
  const [resume, setResume] = useState(initialResume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/resume/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? 'Unable to create suggestions');
      const saved = ResumeVersionSchema.parse(body.data);
      setResume(saved);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create suggestions'); }
    finally { setBusy(false); }
  }
  async function save(editedBullets: ResumeVersion['editedBullets']) {
    if (!resume) throw new Error('No version selected');
    const response = await fetch(`/api/resume/${resume.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editedBullets }) });
    if (!response.ok) throw new Error('Unable to save edits');
    const saved = ResumeVersionSchema.parse((await response.json()).data);
    setResume(saved);
  }
  return <>
    <p className="cf-match-eyebrow">RÉSUMÉ SUGGESTIONS</p>
    <h1>{job.title}</h1><p>{job.company}</p>
    <aside className="cf-match-notice" aria-label="Suggestion status">
      <strong>{resume ? 'Your saved résumé version' : 'Start from your experience facts'}</strong>
      <p>Creating suggestions sends this job and your saved experience facts to the configured AI service.</p>
      <p>Suggestions select verbatim text from your saved facts. Review relevance to the job and check your edits before using them.</p>
      {!configured && <p>New suggestions are currently unavailable. You can still edit an existing saved version.</p>}
      <p><a href="/profile">Review your experience facts</a></p>
    </aside>
    <button className="cf-button" type="button" disabled={busy || !configured} onClick={generate}>
      {busy ? 'Creating suggestions…' : resume ? 'Create another version' : 'Create résumé suggestions'}
    </button>
    {error && <p role="alert" className="cf-error">{error}</p>}
    {resume && <MatchReview key={resume.id} resume={resume} onSave={save} />}
  </>;
}
