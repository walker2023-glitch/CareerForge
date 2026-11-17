'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StudentFact, StudentProfile } from '../../../contracts';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { addFact, removeFact, updateFact, validateProfileDraft, PROFILE_LIMITS, ProfileSaveError, type ProfileDraft } from './profile-model';

export type ProfileFormProps = {
  initialProfile: StudentProfile;
  // Component callback, not a new API contract. Adapter wiring awaits Keyan/Dallas.
  onSave?: (draft: ProfileDraft, expectedUpdatedAt: string) => Promise<StudentProfile>;
};
const factKinds: { kind: StudentFact['kind']; label: string }[] = [
  { kind: 'skill', label: 'Skill' }, { kind: 'education', label: 'Education' },
  { kind: 'project', label: 'Project' }, { kind: 'experience', label: 'Experience' }, { kind: 'interest', label: 'Interest' },
];
const editable = (profile: StudentProfile): ProfileDraft => ({ displayName: profile.displayName, field: profile.field, facts: profile.facts.map(fact => ({ ...fact })) });

export function ProfileForm({ initialProfile, onSave }: ProfileFormProps) {
  const [draft, setDraft] = useState(() => editable(initialProfile));
  const [version, setVersion] = useState(initialProfile.updatedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (pendingFocus.current) {
      document.getElementById(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  }, [draft.facts.length]);

  function changed(next: ProfileDraft) {
    setDraft(next); setErrors({}); setStatus(''); setSaveError('');
  }
  function append(kind: StudentFact['kind']) {
    const id = crypto.randomUUID();
    pendingFocus.current = `fact-${id}-text`;
    changed(addFact(draft, kind, id));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const result = validateProfileDraft(draft);
    setStatus(''); setSaveError('');
    if (!result.success) {
      setErrors(result.errors);
      // Focus after React has associated field errors with the controls.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error-summary]')?.focus());
      return;
    }
    setErrors({});
    if (!onSave) {
      setStatus('Profile checks passed. Nothing was saved; saving is not connected yet.');
      return;
    }
    savingRef.current = true; setSaving(true);
    try {
      const saved = await onSave(result.data, version);
      setDraft(editable(saved)); setVersion(saved.updatedAt);
      setStatus('Profile saved.');
    } catch (error) {
      setSaveError(error instanceof ProfileSaveError && error.code === 'conflict'
        ? 'Your profile changed elsewhere. Your edits are still here. Copy them before reloading the latest version.'
        : 'Could not save your profile. Your edits are still here. Try again.');
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <form ref={formRef} className="cf-profile-form" onSubmit={submit} noValidate aria-label="Student profile" aria-busy={saving}>
    <fieldset disabled={saving} className="cf-profile-fieldset">
      <section className="cf-profile-card" aria-labelledby="profile-about-heading">
        <p className="cf-profile-eyebrow">01 / YOUR DIRECTION</p><h2 id="profile-about-heading">A little about you</h2>
        <div className="cf-profile-grid">
          <Input label="Display name" name="displayName" autoComplete="name" maxLength={PROFILE_LIMITS.name} required value={draft.displayName} error={errors.displayName} onChange={event => changed({ ...draft, displayName: event.target.value })} />
          <Input label="Career field" name="field" maxLength={PROFILE_LIMITS.field} value={draft.field ?? ''} hint="Optional. What kind of work interests you?" error={errors.field} onChange={event => changed({ ...draft, field: event.target.value })} />
        </div>
      </section>
      <section className="cf-profile-card" aria-labelledby="profile-facts-heading">
        <div className="cf-profile-section-heading"><div><p className="cf-profile-eyebrow">02 / YOUR EVIDENCE</p><h2 id="profile-facts-heading">Experience comes in many forms.</h2></div><span className="cf-profile-count">{draft.facts.length} / {PROFILE_LIMITS.facts}</span></div>
        <p className="cf-hint">Projects, coursework, part-time jobs and interests all count. Describe what you actually did; specific facts make stronger résumé evidence.</p>
        {errors.facts && <p role="alert" data-error-summary tabIndex={-1} className="cf-error">{errors.facts}</p>}
        {draft.facts.length === 0 && <div className="cf-profile-empty"><strong>No experience added yet.</strong><p>Start with one skill or something you built.</p></div>}
        <div className="cf-profile-facts">
          {draft.facts.map((fact, index) => <fieldset key={fact.id} className="cf-profile-fact">
            <legend>{factKinds.find(item => item.kind === fact.kind)?.label} {index + 1}</legend>
            <div className="cf-profile-fact-top"><label htmlFor={`fact-${fact.id}-kind`}>Entry type</label><select id={`fact-${fact.id}-kind`} className="cf-input" value={fact.kind} onChange={event => changed(updateFact(draft, fact.id, { kind: event.target.value as StudentFact['kind'] }))}>{factKinds.map(item => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select><Button variant="secondary" aria-label={`Remove entry ${index + 1}`} onClick={() => {
              changed(removeFact(draft, fact.id));
              requestAnimationFrame(() => document.getElementById('profile-add-skill')?.focus());
            }}>Remove</Button></div>
            <Textarea id={`fact-${fact.id}-text`} label={`What you did — entry ${index + 1}`} rows={3} maxLength={2000} value={fact.text} error={errors[`facts.${index}.text`]} required onChange={event => changed(updateFact(draft, fact.id, { text: event.target.value }))} />
            <div className="cf-profile-grid">
              <Input label={`Organization — entry ${index + 1}`} maxLength={PROFILE_LIMITS.organization} value={fact.org ?? ''} hint="Optional. School, employer or group." error={errors[`facts.${index}.org`]} onChange={event => changed(updateFact(draft, fact.id, { org: event.target.value }))} />
              <Input label={`Dates — entry ${index + 1}`} maxLength={PROFILE_LIMITS.dates} value={fact.dates ?? ''} placeholder="e.g. Fall 2026" hint="Optional. Use dates you know." error={errors[`facts.${index}.dates`]} onChange={event => changed(updateFact(draft, fact.id, { dates: event.target.value }))} />
            </div>
          </fieldset>)}
        </div>
        <div className="cf-profile-add" aria-label="Add experience">
          {factKinds.map(({ kind, label }) => <Button key={kind} id={`profile-add-${kind}`} variant="secondary" disabled={draft.facts.length >= PROFILE_LIMITS.facts} onClick={() => append(kind)}>+ Add {label.toLowerCase()}</Button>)}
        </div>
      </section>
      <div className="cf-profile-save">
        {!onSave && <Button type="submit">Check profile</Button>}
        <Button type={onSave ? 'submit' : 'button'} disabled={!onSave} loading={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
        {!onSave && <p className="cf-hint">Saving is unavailable until the secure profile adapter is connected. Reloading resets this fictional preview.</p>}
      </div>
    </fieldset>
    {saveError && <p className="cf-profile-alert" role="alert">{saveError}</p>}
    <p className="cf-profile-status" role="status" aria-live="polite">{status}</p>
  </form>;
}
