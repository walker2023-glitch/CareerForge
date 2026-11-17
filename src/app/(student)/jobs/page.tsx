import { listPublishedJobs } from '../../../lib/jobs/job-adapter';
import { fixtureBrowseJobs } from './fixture-browse-jobs';
import { PasteJobForm } from './PasteJobForm';
import { PublishedJobsBrowse } from './PublishedJobsBrowse';
import '../../../styles/tokens.css';
import '../../../styles/components.css';
import './jobs.css';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const fixtureMode = process.env.CAREERFORGE_E2E_JOBS_FIXTURE === '1';
  let jobs: Awaited<ReturnType<typeof listPublishedJobs>> = [];
  let loadError = false;
  try { jobs = fixtureMode ? fixtureBrowseJobs() : await listPublishedJobs(); }
  catch { loadError = true; }
  const sectionLabel = fixtureMode ? 'Example opportunity' : 'Published opportunities';

  return (
    <div className="cf-jobs">
      <div className="cf-jobs-shell">
        <main id="main" tabIndex={-1}>
          <p className="cf-jobs-eyebrow">FIND A JOB</p>
          <h1>Find opportunities worth pursuing.</h1>
          <p className="cf-jobs-intro">
            Browse published opportunities or paste a job description to create a private preview.
          </p>

          <aside className="cf-jobs-notice" aria-label="What this page can and cannot do">
            <strong>
              {loadError ? 'Job service unavailable' : fixtureMode ? 'Nothing here is saved yet.' : 'Published opportunities'}
            </strong>
            <p>
              {loadError ? 'Published jobs cannot be loaded right now. You can preview pasted text; saving requires the job service.' : fixtureMode
                ? 'Pasting a job builds an unsaved preview in your browser.'
                : 'Published employer opportunities are loaded securely from Career Forge.'}
              {' '}Every job is treated as <em>unverified</em> until a real source confirms it.
            </p>
          </aside>

          <section className="cf-jobs-example" aria-label={sectionLabel}>
            <div className="cf-jobs-card-top">
              <span className="cf-jobs-badge cf-jobs-badge--example">
                {fixtureMode ? 'Example opportunity' : 'Published opportunity'}
              </span>
              <span className="cf-jobs-badge cf-jobs-badge--muted">● Unverified</span>
            </div>

            {jobs.length === 0 ? (
              <div role="status">
                <h2>{loadError ? 'Unable to load published opportunities' : 'No published opportunities yet'}</h2>
                <p className="cf-jobs-card-note">
                  Check back soon or paste a job description below.
                </p>
              </div>
            ) : (
              <PublishedJobsBrowse jobs={jobs} fixtureMode={fixtureMode} sectionLabel={sectionLabel} />
            )}
          </section>

          <h2 className="cf-jobs-form-heading">Paste your own</h2>
          <PasteJobForm />
        </main>
      </div>
    </div>
  );
}