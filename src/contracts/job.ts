import { z } from 'zod';

export const JobTypeSchema = z.enum(['internship', 'full_time', 'part_time', 'co_op', 'contract', 'unknown']);
export const WorkModeSchema = z.enum(['remote', 'hybrid', 'on_site', 'unknown']);
export const JobDraftSchema = z.object({
  title: z.string().trim().min(1).max(300), company: z.string().trim().min(1).max(300), description: z.string().min(1).max(20000),
  location: z.string().nullable(), jobType: JobTypeSchema, workMode: WorkModeSchema,
  sourceUrl: z.string().url().regex(/^https:\/\//).nullable(), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export const JobPostingSchema = JobDraftSchema.extend({
  id: z.string().uuid(), source: z.enum(['pasted', 'claude_web', 'employer', 'provider']),
  providerName: z.string().nullable(), externalId: z.string().nullable(),
  createdByUserId: z.string().uuid(), employerId: z.string().uuid().nullable(),
  status: z.enum(['private', 'draft', 'published', 'paused', 'hidden']),
  retrievedAt: z.string().datetime().nullable(), deadlineVerified: z.boolean(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type JobDraft = z.infer<typeof JobDraftSchema>;
export type JobPosting = z.infer<typeof JobPostingSchema>;
