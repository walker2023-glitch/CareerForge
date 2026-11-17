import { z } from 'zod';
import {
  ResumeVersionSchema,
  type ResumeVersion,
  type JobPosting,
  type StudentFact,
} from '../../contracts';
import { readBoundedBody, MAX_RAW_BODY_BYTES } from '../jobs/read-bounded-body';
import { generateResumeSuggestions, type ModelCaller } from './resume-suggest';

export interface ResumeDataAdapter {
  getAuthorizedJob(id: string): Promise<JobPosting | null>;
  getStudentFacts(userId: string): Promise<StudentFact[]>;
  createResumeVersion(input: {
    jobId: string;
    generatedPayload: {
      generatedBullets: ResumeVersion['generatedBullets'];
      match: ResumeVersion['match'];
    };
    editedBullets: ResumeVersion['editedBullets'];
    factSnapshot: StudentFact[];
  }): Promise<ResumeVersion>;
  getOwnResumeVersion(id: string): Promise<ResumeVersion | null>;
  updateOwnResumeEditedBullets(
    id: string,
    editedBullets: ResumeVersion['editedBullets'],
  ): Promise<ResumeVersion | null>;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export type GetUserFn = () => Promise<AuthenticatedUser | null>;

export interface ResumeHandlerDependencies {
  getUser?: GetUserFn;
  adapter?: Partial<ResumeDataAdapter>;
  modelCaller?: ModelCaller;
  apiKey?: string;
}

const SuggestBodySchema = z.object({
  jobId: z.string().uuid(),
});

const PatchBodySchema = z.object({
  editedBullets: z
    .array(
      z.object({
        id: z.string().uuid(),
        text: z.string().max(2000),
      }),
    )
    .max(10),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function requireUser(deps: ResumeHandlerDependencies): Promise<AuthenticatedUser | Response> {
  if (deps.getUser) {
    const user = await deps.getUser();
    if (!user) {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    return user;
  }

  try {
    const { createSupabaseServerClient } = await import('../supabase/server');
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    return { id: user.id, email: user.email ?? undefined };
  } catch {
    return errorResponse(401, 'UNAUTHENTICATED', 'Authentication required');
  }
}

export async function handleSuggestResume(
  request: Request,
  deps: ResumeHandlerDependencies = {},
): Promise<Response> {
  const auth = await requireUser(deps);
  if (auth instanceof Response) return auth;

  const bodyResult = await readBoundedBody(request, MAX_RAW_BODY_BYTES);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.status, bodyResult.code, bodyResult.message);
  }

  const rawText = bodyResult.text.trim();
  if (!rawText) {
    return errorResponse(400, 'INVALID_INPUT', 'Request body is empty');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return errorResponse(400, 'INVALID_INPUT', 'Request body must be valid JSON');
  }

  const body = SuggestBodySchema.safeParse(parsedJson);
  if (!body.success) {
    const firstIssue = body.error.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'field'}: ${firstIssue.message}`
      : 'Invalid suggest request';
    return errorResponse(400, 'INVALID_INPUT', message);
  }

  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps.modelCaller) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Resume suggestion is not configured. Missing Anthropic API key.',
    );
  }

  const adapter = deps.adapter;
  if (
    !adapter?.getAuthorizedJob ||
    !adapter?.getStudentFacts ||
    !adapter?.createResumeVersion ||
    !deps.modelCaller
  ) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Resume persistence adapter is not available. Configure persistence.',
    );
  }

  try {
    const job = await adapter.getAuthorizedJob(body.data.jobId);
    if (!job) return errorResponse(404, 'NOT_FOUND', 'Job not found');
    const facts = await adapter.getStudentFacts(auth.id);
    if (!facts.length) return errorResponse(400, 'NO_EVIDENCE', 'Add experience facts to your profile before requesting suggestions.');
    const generated = await generateResumeSuggestions({ userId: auth.id, job, facts, modelCaller: deps.modelCaller });
    if (!generated.ok) return errorResponse(generated.code === 'INVALID_INPUT' ? 400 : 503, generated.code, generated.message);
    const version = generated.version;
    const saved = await adapter.createResumeVersion({
      jobId: job.id, generatedPayload: { generatedBullets: version.generatedBullets, match: version.match },
      editedBullets: version.editedBullets, factSnapshot: facts,
    });
    const checked = ResumeVersionSchema.safeParse(saved);
    if (!checked.success || checked.data.userId !== auth.id || checked.data.jobId !== job.id)
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Unable to save suggestions');
    return successResponse(checked.data, 201);
  } catch {
    return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Unable to generate and save suggestions');
  }
}

export async function handleGetResume(
  id: string,
  deps: ResumeHandlerDependencies = {},
): Promise<Response> {
  const auth = await requireUser(deps);
  if (auth instanceof Response) return auth;

  if (!id || !UUID_REGEX.test(id)) {
    return errorResponse(404, 'NOT_FOUND', 'Resume version not found');
  }

  const getFn = deps.adapter?.getOwnResumeVersion;
  if (!getFn) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Resume read adapter is not available. Configure persistence.',
    );
  }

  try {
    const version = await getFn(id);
    if (!version) {
      return errorResponse(404, 'NOT_FOUND', 'Resume version not found');
    }

    const validated = ResumeVersionSchema.safeParse(version);
    if (!validated.success) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Server returned malformed resume data');
    }

    return successResponse(validated.data, 200);
  } catch (err: unknown) {
    const message = 'Unable to load resume version';
    return errorResponse(503, 'SERVICE_UNAVAILABLE', message);
  }
}

export async function handlePatchResume(
  id: string,
  request: Request,
  deps: ResumeHandlerDependencies = {},
): Promise<Response> {
  const auth = await requireUser(deps);
  if (auth instanceof Response) return auth;

  if (!id || !UUID_REGEX.test(id)) {
    return errorResponse(404, 'NOT_FOUND', 'Resume version not found');
  }

  const bodyResult = await readBoundedBody(request, MAX_RAW_BODY_BYTES);
  if (!bodyResult.ok) {
    return errorResponse(bodyResult.status, bodyResult.code, bodyResult.message);
  }

  const rawText = bodyResult.text.trim();
  if (!rawText) {
    return errorResponse(400, 'INVALID_INPUT', 'Request body is empty');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return errorResponse(400, 'INVALID_INPUT', 'Request body must be valid JSON');
  }

  const body = PatchBodySchema.safeParse(parsedJson);
  if (!body.success) {
    const firstIssue = body.error.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.') || 'field'}: ${firstIssue.message}`
      : 'Invalid edited bullets';
    return errorResponse(400, 'INVALID_INPUT', message);
  }

  const updateFn = deps.adapter?.updateOwnResumeEditedBullets;
  if (!updateFn) {
    return errorResponse(
      503,
      'SERVICE_UNAVAILABLE',
      'Resume edit adapter is not available. Configure persistence.',
    );
  }

  try {
    const updated = await updateFn(id, body.data.editedBullets);
    if (!updated) {
      return errorResponse(404, 'NOT_FOUND', 'Resume version not found');
    }

    const validated = ResumeVersionSchema.safeParse(updated);
    if (!validated.success) {
      return errorResponse(503, 'SERVICE_UNAVAILABLE', 'Server returned malformed resume data');
    }

    return successResponse(validated.data, 200);
  } catch (err: unknown) {
    const message = 'Unable to update resume version';
    return errorResponse(503, 'SERVICE_UNAVAILABLE', message);
  }
}
