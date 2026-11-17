import { JobDraftSchema, JobPostingSchema, type JobDraft, type JobPosting } from '../../contracts';
import { readBoundedBody, MAX_RAW_BODY_BYTES } from './read-bounded-body';

export interface JobDataAdapter {
  createPrivateJobImport(draft: JobDraft): Promise<JobPosting>;
  getAuthorizedJob(id: string): Promise<JobPosting | null>;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export type GetUserFn = () => Promise<AuthenticatedUser | null>;

export interface JobHandlerDependencies {
  getUser?: GetUserFn;
  adapter?: Partial<JobDataAdapter>;
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleImportJob(
  request: Request,
  deps: JobHandlerDependencies = {},
): Promise<Response> {


  // 1. Authenticate caller session
  if (!deps.getUser) {
    // If no custom getUser is injected, attempt Supabase server client if available
    try {
      const { createSupabaseServerClient } = await import('../supabase/server');
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
      }
    } catch {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
    }
  } else {
    const user = await deps.getUser();
    if (!user) {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
    }
  }

  // 2. Bound raw request body before JSON parsing
  const bodyResult = await readBoundedBody(request, MAX_RAW_BODY_BYTES);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.status, bodyResult.code, bodyResult.message);
  }

  const rawText = bodyResult.text.trim();
  if (!rawText) {
    return errorResponse(400, 'INVALID_INPUT', 'Request body is empty');
  }

  // 3. Safe JSON parsing of bounded body
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return errorResponse(400, 'INVALID_INPUT', 'Request body must be valid JSON');
  }

  // 4. Validate input with JobDraftSchema
  const draftResult = JobDraftSchema.safeParse(parsedJson);
  if (!draftResult.success) {
    const firstIssue = draftResult.error.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'field'}: ${firstIssue.message}`
      : 'Invalid job draft data';
    return errorResponse(400, 'INVALID_INPUT', message);
  }

  // 5. Check adapter availability
  const createImportFn = deps.adapter?.createPrivateJobImport;
  if (!createImportFn) {
    // Dependency injection fallback used by isolated handler tests.
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Job persistence adapter is not available. Configure the database adapter.',
    );
  }

  // 6. Delegate to adapter
  try {
    const persisted = await createImportFn(draftResult.data);
    const validated = JobPostingSchema.safeParse(persisted);
    if (!validated.success) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Server returned malformed job data');
    }

    return successResponse(validated.data, 200);
  } catch (err: unknown) {
    const message = 'Unable to import job';
    return errorResponse(503, 'SERVICE_UNAVAILABLE', message);
  }
}

export async function handleGetJob(
  id: string,
  deps: JobHandlerDependencies = {},
): Promise<Response> {
  // 1. Authenticate caller session
  if (!deps.getUser) {
    try {
      const { createSupabaseServerClient } = await import('../supabase/server');
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
      }
    } catch {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
    }
  } else {
    const user = await deps.getUser();
    if (!user) {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
    }
  }

  // 2. Validate UUID format
  if (!id || !UUID_REGEX.test(id)) {
    return errorResponse(404, 'NOT_FOUND', 'Job not found');
  }

  // 3. Check adapter availability
  const getJobFn = deps.adapter?.getAuthorizedJob;
  if (!getJobFn) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Job read adapter is not available. Configure the database adapter.',
    );
  }

  // Query through the session client and RLS.
  try {
    const job = await getJobFn(id);
    if (!job) {
      // Indistinguishable 404 for non-existent and foreign private jobs
      return errorResponse(404, 'NOT_FOUND', 'Job not found');
    }

    const validated = JobPostingSchema.safeParse(job);
    if (!validated.success) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Server returned malformed job data');
    }

    return successResponse(validated.data, 200);
  } catch (err: unknown) {
    const message = 'Unable to load job';
    return errorResponse(503, 'SERVICE_UNAVAILABLE', message);
  }
}
