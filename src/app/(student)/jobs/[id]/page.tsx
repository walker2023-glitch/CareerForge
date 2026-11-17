import type { JobPosting } from '../../../../contracts';
import { getAuthorizedJob } from '../../../../lib/jobs/job-adapter';
import { JOB_TYPE_LABELS, WORK_MODE_LABELS } from '../paste-job';
import { findFixtureJob } from '../job-lookup';
import '../../../../styles/tokens.css';
import '../../../../styles/components.css';
import '../jobs.css';

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const fixtureMode = process.env.CAREERFORGE_E2E_JOBS_FIXTURE === '1';

  const job = fixtureMode
    ? findFixtureJob(id)
    : await getAuthorizedJob(id);

  return (
    <div className="cf-jobs">
      <div className="cf-jobs-shell">
        <main id="main" tabIndex={-1}>
          <p style={{ margin: '0 0 1.5rem' }}>
            <a href="/jobs" className="cf-jobs-back">← Back to jobs</a>
          </p>
          {job ? (
            <KnownJobDetail job={job} fixtureMode={fixtureMode} />
          ) : (
            <MissingJobDetail fixtureMode={fixtureMode} id={id} />
          )}
        </main>
      </div>
    </div>
  );
}

function KnownJobDetail({
  job,
  fixtureMode,
}: {
  job: JobPosting;
  fixtureMode: boolean;
}) {
  return (
    <>
      <p className="cf-jobs-eyebrow">JOB DETAIL</p>

      <div className="cf-jobs-card-top" style={{ marginBottom: '0.75rem' }}>
        <span className="cf-jobs-badge cf-jobs-badge--example">
          {fixtureMode ? 'Example opportunity' : job.status === 'private' ? 'Your private job' : 'Published opportunity'}
        </span>
        <span className="cf-jobs-badge cf-jobs-badge--muted">● Unverified</span>
      </div>

      <h1>{job.title}</h1>

      <p className="cf-jobs-intro">
        {job.company}
        {job.location ? ` · ${job.location}` : ''}
        {` · ${JOB_TYPE_LABELS[job.jobType]} · ${WORK_MODE_LABELS[job.workMode]}`}
      </p>

      <aside className="cf-jobs-notice" aria-label="Job status">
        <strong>
          {fixtureMode ? 'Fixture preview — not loaded from the database.' : job.status === 'private' ? 'Your private job' : 'Published job'}
        </strong>
        <p>
          {fixtureMode
            ? 'This is fictional sample data used for UI testing.'
            : 'This job was loaded from Career Forge with authenticated access.'}
          {' '}The deadline is {job.deadlineVerified ? 'verified' : 'unverified'}.
        </p>
      </aside>

      <article className="cf-jobs-card" aria-label="Job posting">
        <h2>Description</h2>
        <p className="cf-jobs-card-description">{job.description}</p>

        {job.deadline && (
          <p className="cf-jobs-card-meta">
            Deadline (unverified): {job.deadline}
          </p>
        )}

        {job.sourceUrl && (
          <p className="cf-jobs-card-source">
            Source:{' '}
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
              {job.sourceUrl}
            </a>
          </p>
        )}

        <p className="cf-jobs-card-meta">
          Source type: {job.source} · Status: {job.status}
        </p>
      </article>

      <section className="cf-jobs-next" aria-label="Next steps">
        <h2>Next steps</h2>
        <p className="cf-jobs-card-note">
          Review evidence from your experience facts and edit your résumé suggestions.
          New suggestions require a configured service; preparation remains a sample preview.
        </p>
        <a className="cf-button" href={`/match/${job.id}`}>
          Review match
        </a>
        <a className="cf-button cf-button--secondary" href={`/jobs/${job.id}/prep`}>
          Prep for this role
        </a>
        <a className="cf-button cf-button--secondary" href="/saved">
          View saved applications
        </a>
      </section>
    </>
  );
}

function MissingJobDetail({
  fixtureMode,
  id,
}: {
  fixtureMode: boolean;
  id: string;
}) {
  return (
    <>
      <p className="cf-jobs-eyebrow">JOB DETAIL</p>
      <h1>Job not available</h1>

      <aside className="cf-jobs-notice" aria-label="Missing job">
        <strong>
          {fixtureMode
            ? 'No fixture posting matches this id.'
            : 'No accessible job matches this id.'}
        </strong>
        <p>
          Published jobs appear in the list on /jobs. Parse previews are not stored until you save a private
          import. Return to jobs to pick a published opportunity or paste again.
        </p>
      </aside>

      <p className="cf-jobs-card-meta">Requested id: {id}</p>

      <a className="cf-button" href="/jobs">
        {fixtureMode ? 'Back to paste a job' : 'Back to jobs'}
      </a>
    </>
  );
}