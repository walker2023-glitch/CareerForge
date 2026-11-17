import { JobDraftSchema, JobPostingSchema, type JobDraft, type JobPosting } from '../../../contracts';

export const JOB_IMPORT_ROUTE = '/api/jobs/import';

/** Requests are enabled; successful persistence still requires configured Supabase. */
export const IS_JOB_PERSISTENCE_AVAILABLE = true;

type ApiSuccess<T> = { data: T };
type ApiFailure = { error: { code: string; message: string } };

export type ImportJobResult =
  | { ok: true; posting: JobPosting }
  | { ok: false; status: 'not_available' }
  | { ok: false; status: 'network' }
  | { ok: false; status: 400 | 401 | 403 | 404 | 503; message: string };

export type GetJobResult =
  | { ok: true; posting: JobPosting }
  | { ok: false; status: 'not_available' }
  | { ok: false; status: 'network' }
  | { ok: false; status: 401 | 403 | 404 | 503; message: string };

export function jobDraftFromPosting(posting: JobPosting): JobDraft {
  return JobDraftSchema.parse({
    title: posting.title,
    company: posting.company,
    description: posting.description,
    location: posting.location,
    jobType: posting.jobType,
    workMode: posting.workMode,
    sourceUrl: posting.sourceUrl,
    deadline: posting.deadline,
  });
}

function jobPath(id: string): string {
  return `/api/jobs/${encodeURIComponent(id)}`;
}

function mapHttpFailure(status: number, body: ApiFailure | null): { status: 400 | 401 | 403 | 404 | 503; message: string } {
  const message = body?.error?.message ?? 'Request failed';
  if (status === 400) return { status: 400, message };
  if (status === 401) return { status: 401, message };
  if (status === 403) return { status: 403, message };
  if (status === 404) return { status: 404, message };
  return { status: 503, message };
}

/** Low-level import call (no feature guard). Used by unit tests and importPrivateJob when enabled. */
export async function requestImportJob(draft: JobDraft, fetcher: typeof fetch): Promise<ImportJobResult> {
  try {
    const response = await fetcher(JOB_IMPORT_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });

    const json = (await response.json().catch(() => null)) as ApiSuccess<unknown> | ApiFailure | null;

    if (response.ok && json && 'data' in json) {
      const validated = JobPostingSchema.safeParse(json.data);
      if (validated.success) {
        return { ok: true, posting: validated.data };
      }
      return { ok: false, status: 503, message: 'Server returned malformed job data' };
    }

    return { ok: false, ...mapHttpFailure(response.status, json && 'error' in json ? json : null) };
  } catch {
    return { ok: false, status: 'network' };
  }
}

/** Low-level authorized read (no feature guard). */
export async function requestGetJob(id: string, fetcher: typeof fetch): Promise<GetJobResult> {
  try {
    const response = await fetcher(jobPath(id), { method: 'GET' });

    const json = (await response.json().catch(() => null)) as ApiSuccess<unknown> | ApiFailure | null;

    if (response.ok && json && 'data' in json) {
      const validated = JobPostingSchema.safeParse(json.data);
      if (validated.success) {
        return { ok: true, posting: validated.data };
      }
      return { ok: false, status: 503, message: 'Server returned malformed job data' };
    }

    const errBody = json && 'error' in json ? json : null;
    const failure = mapHttpFailure(response.status, errBody);
  return {
      ok: false,
      status: failure.status === 400 ? 503 : failure.status,
      message: failure.message,
    };
  } catch {
    return { ok: false, status: 'network' };
  }
}

export async function importPrivateJob(
  draft: JobDraft,
  customFetch?: typeof fetch,
): Promise<ImportJobResult> {
  if (!IS_JOB_PERSISTENCE_AVAILABLE) {
    return { ok: false, status: 'not_available' };
  }
  return requestImportJob(draft, customFetch ?? globalThis.fetch);
}

export async function getAuthorizedJob(id: string, customFetch?: typeof fetch): Promise<GetJobResult> {
  if (!IS_JOB_PERSISTENCE_AVAILABLE) {
    return { ok: false, status: 'not_available' };
  }
  return requestGetJob(id, customFetch ?? globalThis.fetch);
}