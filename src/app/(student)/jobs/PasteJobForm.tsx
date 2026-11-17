'use client';

import { useRef, useState } from 'react';
import type { JobPosting } from '../../../contracts';
import { submitPasteJob } from '../../../lib/jobs/submit-paste';
import {
  IS_JOB_PERSISTENCE_AVAILABLE,
  importPrivateJob,
  jobDraftFromPosting,
} from './job-api-client';
import {
  JOB_TYPE_LABELS,
  JOB_TYPE_OPTIONS,
  WORK_MODE_LABELS,
  WORK_MODE_OPTIONS,
  type PasteJobFieldErrors,
  type PasteJobInput,
} from './paste-job';

const EMPTY: PasteJobInput = {
  title: '', company: '', description: '', location: '',
  jobType: 'unknown', workMode: 'unknown', sourceUrl: '', deadline: '',
};

export function PasteJobForm() {
  const [values, setValues] = useState<PasteJobInput>(EMPTY);
  const [errors, setErrors] = useState<PasteJobFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<JobPosting | null>(null);
  const [savedPosting, setSavedPosting] = useState<JobPosting | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const sourceUrlRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof PasteJobInput) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setValues(current => ({ ...current, [field]: event.target.value }));

  const focusFirstError = (fieldErrors: PasteJobFieldErrors) => {
    if (fieldErrors.title) titleRef.current?.focus();
    else if (fieldErrors.company) companyRef.current?.focus();
    else if (fieldErrors.description) descriptionRef.current?.focus();
    else if (fieldErrors.sourceUrl) sourceUrlRef.current?.focus();
    else if (fieldErrors.deadline) deadlineRef.current?.focus();
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setServerError(null);

    const result = await submitPasteJob(values);
    setIsSubmitting(false);

    if (result.ok) {
      setErrors({});
      setPreview(result.posting);
      setSavedPosting(null);
      setSaveError(null);
    } else {
      setPreview(null);
      setSavedPosting(null);
      setErrors(result.errors);
      if (result.message && !Object.keys(result.errors).length) {
        setServerError(result.message);
      }
      focusFirstError(result.errors);
    }
  };

  const describedBy = (field: keyof PasteJobInput, hintId?: string) =>
    [hintId, errors[field] ? `${field}-error` : null].filter(Boolean).join(' ') || undefined;

  const onSavePrivate = async () => {
    if (!preview || !IS_JOB_PERSISTENCE_AVAILABLE) return;
    setIsSaving(true);
    setSaveError(null);
    const result = await importPrivateJob(jobDraftFromPosting(preview));
    setIsSaving(false);
    if (result.ok) {
      setSavedPosting(result.posting);
      return;
    }
    if (result.status === 'not_available') {
      setSaveError('Save is not connected yet.');
      return;
    }
    if (result.status === 'network') {
      setSaveError('Unable to reach the job service. Try again.');
      return;
    }
    if (result.status === 401) {
      setSaveError('Sign in to save this job.');
      return;
    }
    setSaveError(result.message);
  };

  return (
    <div className="cf-jobs-grid">
      <form className="cf-jobs-form" aria-label="Paste a job description" noValidate onSubmit={onSubmit}>
        {serverError && (
          <p className="cf-error" role="alert" id="server-error">{serverError}</p>
        )}

        <div className="cf-field">
          <label className="cf-label" htmlFor="title">Job title</label>
          <input
            ref={titleRef} id="title" name="title" className="cf-input" value={values.title}
            onChange={update('title')} aria-invalid={errors.title ? true : undefined}
            aria-describedby={describedBy('title')}
          />
          {errors.title && <p className="cf-error" id="title-error">{errors.title}</p>}
        </div>

        <div className="cf-field">
          <label className="cf-label" htmlFor="company">Company</label>
          <input
            ref={companyRef} id="company" name="company" className="cf-input" value={values.company}
            onChange={update('company')} aria-invalid={errors.company ? true : undefined}
            aria-describedby={describedBy('company')}
          />
          {errors.company && <p className="cf-error" id="company-error">{errors.company}</p>}
        </div>

        <div className="cf-field">
          <label className="cf-label" htmlFor="description">Job description</label>
          <p className="cf-hint" id="description-hint">Paste the full text from the posting. It is rendered as plain text, never as HTML.</p>
          <textarea
            ref={descriptionRef} id="description" name="description" className="cf-input" rows={8}
            value={values.description} onChange={update('description')}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy('description', 'description-hint')}
          />
          {errors.description && <p className="cf-error" id="description-error">{errors.description}</p>}
        </div>

        <div className="cf-field">
          <label className="cf-label" htmlFor="location">Location <span className="cf-jobs-optional">(optional)</span></label>
          <input id="location" name="location" className="cf-input" value={values.location} onChange={update('location')} />
        </div>

        <div className="cf-jobs-row">
          <div className="cf-field">
            <label className="cf-label" htmlFor="jobType">Job type</label>
            <select id="jobType" name="jobType" className="cf-input" value={values.jobType} onChange={update('jobType')}>
              {JOB_TYPE_OPTIONS.map(option => <option key={option} value={option}>{JOB_TYPE_LABELS[option]}</option>)}
            </select>
          </div>
          <div className="cf-field">
            <label className="cf-label" htmlFor="workMode">Work arrangement</label>
            <select id="workMode" name="workMode" className="cf-input" value={values.workMode} onChange={update('workMode')}>
              {WORK_MODE_OPTIONS.map(option => <option key={option} value={option}>{WORK_MODE_LABELS[option]}</option>)}
            </select>
          </div>
        </div>

        <div className="cf-field">
          <label className="cf-label" htmlFor="sourceUrl">Source URL <span className="cf-jobs-optional">(optional)</span></label>
          <input
            ref={sourceUrlRef} id="sourceUrl" name="sourceUrl" className="cf-input" inputMode="url" placeholder="https://"
            value={values.sourceUrl} onChange={update('sourceUrl')}
            aria-invalid={errors.sourceUrl ? true : undefined} aria-describedby={describedBy('sourceUrl')}
          />
          {errors.sourceUrl && <p className="cf-error" id="sourceUrl-error">{errors.sourceUrl}</p>}
        </div>

        <div className="cf-field">
          <label className="cf-label" htmlFor="deadline">Application deadline <span className="cf-jobs-optional">(optional, YYYY-MM-DD)</span></label>
          <input
            ref={deadlineRef} id="deadline" name="deadline" className="cf-input" placeholder="2026-12-01"
            value={values.deadline} onChange={update('deadline')}
            aria-invalid={errors.deadline ? true : undefined} aria-describedby={describedBy('deadline')}
          />
          {errors.deadline && <p className="cf-error" id="deadline-error">{errors.deadline}</p>}
        </div>

        <button className="cf-button" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Parsing...' : 'Preview pasted job'}
        </button>
      </form>

      <section className="cf-jobs-preview" aria-label="Pasted job preview" aria-live="polite">
        {preview ? (
          <article className="cf-jobs-card">
            <div className="cf-jobs-card-top">
              <span className="cf-jobs-badge">{savedPosting ? 'Saved privately' : 'Preview — not saved'}</span>
              <span className="cf-jobs-badge cf-jobs-badge--muted">● Unverified</span>
            </div>
            <h3>{preview.title}</h3>
            <p className="cf-jobs-card-meta">
              {preview.company}
              {preview.location ? ` · ${preview.location}` : ''}
              {` · ${JOB_TYPE_LABELS[preview.jobType]} · ${WORK_MODE_LABELS[preview.workMode]}`}
            </p>
            {preview.deadline && <p className="cf-jobs-card-meta">Deadline (unverified): {preview.deadline}</p>}
            <p className="cf-jobs-card-description">{preview.description}</p>
            {preview.sourceUrl && (
              <p className="cf-jobs-card-source">
                Source: <a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">{preview.sourceUrl}</a>
              </p>
            )}
            <p className="cf-jobs-card-note">
              {savedPosting
                ? 'Saved privately to your account. Open the saved job to return to it after reload.'
                : 'Preview only — save it to return after reload.'}
              {!savedPosting && (
                <>
                  {' '}
                  Use <strong>Save as private job</strong> to keep this posting, or open a{' '}
                  <strong>published opportunity</strong> from the list above for the live detail page.
                </>
              )}
            </p>
            {saveError && (
              <p className="cf-error" role="alert">{saveError}</p>
            )}
            <p className="cf-jobs-example-actions">
              <button
                type="button"
                className="cf-button"
                disabled={!IS_JOB_PERSISTENCE_AVAILABLE || isSaving || Boolean(savedPosting)}
                aria-busy={isSaving}
                aria-describedby="save-private-hint"
                onClick={onSavePrivate}
              >
                {IS_JOB_PERSISTENCE_AVAILABLE
                  ? (isSaving ? 'Saving...' : 'Save as private job')
                  : 'Save as private job (not connected)'}
              </button>
              <span className="cf-hint" id="save-private-hint">
                {IS_JOB_PERSISTENCE_AVAILABLE
                  ? 'Persists a private pasted import for your account.'
                  : 'Not connected — no request is sent until POST /api/jobs/import and GET /api/jobs/[id] exist.'}
              </span>
            </p>
            {savedPosting && (
              <p className="cf-jobs-example-actions">
                <a className="cf-button cf-button--secondary" href={`/jobs/${savedPosting.id}`}>
                  Open saved private job
                </a>
              </p>
            )}
          </article>
        ) : (
          <p className="cf-jobs-empty">Your pasted job will appear here as an unsaved preview after you select “Preview pasted job”.</p>
        )}
      </section>
    </div>
  );
}
