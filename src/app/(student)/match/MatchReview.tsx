'use client';

import { useMemo, useState } from 'react';
import type { ResumeVersion } from '../../../contracts';
import { Button } from '../../../components/ui/Button';
import { formatEditedBulletsForCopy } from './match-copy-bullets';

type CopyStatus = { kind: 'success' | 'error'; message: string } | null;

export function MatchReview({ resume, onSave }: { resume: ResumeVersion; onSave?: (bullets: ResumeVersion['editedBullets']) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  async function saveEdits() {
    if (!onSave || saving) return;
    setSaving(true); setSaveStatus(''); setSaveError('');
    try {
      await onSave(resume.generatedBullets.map(b => ({ id: b.id, text: edits[b.id] ?? '' })));
      setSaveStatus('Edits saved to your account.');
    } catch { setSaveError('Could not save edits. Your text is still here. Try again.'); }
    finally { setSaving(false); }
  }
  const initialById = useMemo(
    () => new Map(resume.editedBullets.map(b => [b.id, b.text])),
    [resume.editedBullets],
  );
  const [edits, setEdits] = useState<Record<string, string>>(Object.fromEntries(initialById));
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);

  const factTextById = useMemo(
    () => new Map(resume.factSnapshot.map(f => [f.id, f.text])),
    [resume.factSnapshot],
  );

  const copyEditedBullets = async () => {
    const text = formatEditedBulletsForCopy(resume.generatedBullets, edits);
    if (!text) {
      setCopyStatus({
        kind: 'error',
        message: 'Nothing to copy yet. Add text to at least one bullet.',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus({
        kind: 'success',
        message:
          onSave ? 'Copied your current edited bullets.' : 'Copied your edited bullets to the clipboard. Saving is still not connected — edits will not survive reload.',
      });
    } catch {
      setCopyStatus({
        kind: 'error',
        message: 'Could not copy automatically. Select the bullet text and copy manually.',
      });
    }
  };

  return (
    <>
      <section className="cf-match-section" aria-label="Suggested bullets and evidence">
        <h2>Suggested bullets</h2>
        <p className="cf-match-save-note">
          {onSave ? 'This version is saved. Save your changes before reloading. Edits are student-authored and are not verified against the evidence.' : <><strong>Not saved — review before using.</strong> Edits stay in your browser until secure save routes exist.</>}
        </p>
        <ul className="cf-match-bullets">
          {resume.generatedBullets.map((bullet, index) => (
            <li key={bullet.id} className="cf-match-bullet">
              <label className="cf-label" htmlFor={`bullet-${bullet.id}`}>{`Suggested bullet ${index + 1}`}</label>
              <textarea
                id={`bullet-${bullet.id}`}
                className="cf-input"
                rows={3}
                maxLength={2000}
                disabled={saving}
                value={edits[bullet.id] ?? ''}
                onChange={event => setEdits(current => ({ ...current, [bullet.id]: event.target.value }))}
              />
              <p className="cf-hint">Targets: {bullet.targetsRequirement}</p>
              <div className="cf-match-evidence">
                <p className="cf-label">Evidence (fact ids)</p>
                <ul>
                  {bullet.evidence.map(evidenceId => (
                    <li key={evidenceId}>
                      <code>{evidenceId}</code>
                      {factTextById.has(evidenceId) && (
                        <span className="cf-match-evidence-quote"> — “{factTextById.get(evidenceId)}”</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
        <div className="cf-match-actions">
          <Button type="button" variant="secondary" onClick={copyEditedBullets} aria-describedby="match-copy-hint">
            Copy edited bullets
          </Button>
          <Button type="button" variant="secondary" disabled={!onSave || saving} onClick={saveEdits} aria-describedby="match-save-hint">
            {onSave ? (saving ? 'Saving…' : 'Save edits') : 'Save edits (not connected)'}
          </Button>
        </div>
        <p className="cf-hint" id="match-copy-hint">
          Copy uses your current edits in the text boxes above, not the original generated draft.
        </p>
        <p className="cf-hint" id="match-save-hint">
          {onSave ? 'Saved edits remain separate from the original generated bullets and source evidence.' : 'Saving requires PATCH /api/resume/[id] and is not connected in this fixture slice.'}
        </p>
        {saveStatus && <p role="status">{saveStatus}</p>}
        {saveError && <p role="alert">{saveError}</p>}
        {copyStatus && (
          <p
            className={copyStatus.kind === 'error' ? 'cf-error' : 'cf-hint'}
            role="status"
            aria-live="polite"
          >
            {copyStatus.message}
          </p>
        )}
      </section>

      <section className="cf-match-section" aria-label="Requirement gaps">
        <h2>Gaps</h2>
        <p className="cf-hint">Requirements with no supporting fact in your snapshot — shown explicitly, never hidden.</p>
        {resume.match.gaps.length === 0 ? (
          <p className="cf-match-empty">{onSave ? 'No gaps were returned. This is not a completeness or hiring assessment.' : 'No gaps in this fictional sample.'}</p>
        ) : (
          <ul className="cf-match-gaps">
            {resume.match.gaps.map(gap => (
              <li key={gap.requirement}>
                <span className="cf-match-gap-label">Gap</span>
                <strong>{gap.requirement}</strong>
                <p>{gap.note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}