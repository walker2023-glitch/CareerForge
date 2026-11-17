import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ResumeVersionSchema, StudentFactSchema, type ResumeVersion } from '../../contracts';
import type { ResumeDataAdapter } from '../claude/resume-handlers';
import { createSupabaseServerClient } from '../supabase/server';
import { toJobPosting } from '../jobs/job-adapter';
import { z } from 'zod';

type ResumeRow = {
  id: string; user_id: string; job_id: string;
  generated_payload: Pick<ResumeVersion, 'generatedBullets' | 'match'>;
  edited_bullets: ResumeVersion['editedBullets']; fact_snapshot: ResumeVersion['factSnapshot'];
  created_at: string; updated_at: string;
};
export function toResumeVersion(row: ResumeRow): ResumeVersion {
  return ResumeVersionSchema.parse({
    id: row.id, userId: row.user_id, jobId: row.job_id,
    ...row.generated_payload, editedBullets: row.edited_bullets, factSnapshot: row.fact_snapshot,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  });
}

/** Session client for all reads/edits; privileged writer is used only after generation. */
export function createResumeAdapter(session: SupabaseClient, userId: string, writer?: SupabaseClient): ResumeDataAdapter {
  return {
    async getAuthorizedJob(id) {
      const { data, error } = await session.from('jobs').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error('Unable to load job');
      return data ? toJobPosting(data) : null;
    },
    async getStudentFacts() {
      const role = await session.rpc('has_role', { required_role: 'student' });
      if (role.error || role.data !== true) throw new Error('Student access required');
      const { data, error } = await session.from('student_facts').select('id,kind,text,dates,org').eq('user_id', userId).order('created_at');
      if (error) throw new Error('Unable to load facts');
      return z.array(StudentFactSchema).parse(data);
    },
    async createResumeVersion(input) {
      if (!writer) throw new Error('Resume saving is not configured');
      // Authorization is rechecked after the provider call before privileged insertion.
      const { data: job, error: jobError } = await session.from('jobs').select('id').eq('id', input.jobId).maybeSingle();
      if (jobError || !job) throw new Error('Job unavailable');
      const { data, error } = await writer.from('resume_versions').insert({
        user_id: userId, job_id: input.jobId, generated_payload: input.generatedPayload,
        edited_bullets: input.editedBullets, fact_snapshot: input.factSnapshot,
      }).select('*').single();
      if (error || !data) throw new Error('Unable to save suggestions');
      return toResumeVersion(data);
    },
    async getOwnResumeVersion(id) {
      const { data, error } = await session.from('resume_versions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (error) throw new Error('Unable to load suggestions');
      return data ? toResumeVersion(data) : null;
    },
    async updateOwnResumeEditedBullets(id, editedBullets) {
      const { data, error } = await session.from('resume_versions').update({ edited_bullets: editedBullets }).eq('id', id).eq('user_id', userId).select('*').maybeSingle();
      if (error) throw new Error('Unable to save edits');
      return data ? toResumeVersion(data) : null;
    },
  };
}

export async function createResumeDependencies() {
  try {
    const session = await createSupabaseServerClient();
    const { data: { user }, error } = await session.auth.getUser();
    if (error || !user) return { getUser: async () => null };
    const key = process.env.SUPABASE_SECRET_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // This key never enters a browser bundle or a response. No user data query uses it.
    const writer = key && url ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : undefined;
    return { getUser: async () => user, adapter: createResumeAdapter(session, user.id, writer), canGenerate: Boolean(writer) };
  } catch {
    return { getUser: async () => null };
  }
}

export async function getLatestResumeForJob(jobId: string): Promise<ResumeVersion | null> {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data, error } = await session.from('resume_versions').select('*')
    .eq('user_id', user.id).eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Unable to load saved suggestions');
  return data ? toResumeVersion(data) : null;
}
