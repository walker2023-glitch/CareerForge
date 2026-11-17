import { z } from 'zod';

export const StudentFactSchema = z.object({
  id: z.string().uuid(), kind: z.enum(['skill', 'education', 'project', 'experience', 'interest']),
  text: z.string().min(1), dates: z.string().nullable(), org: z.string().nullable(),
});
export const StudentProfileSchema = z.object({
  userId: z.string().uuid(), displayName: z.string().min(1), field: z.string().nullable(),
  facts: z.array(StudentFactSchema), updatedAt: z.string().datetime(),
});
export type StudentFact = z.infer<typeof StudentFactSchema>;
export type StudentProfile = z.infer<typeof StudentProfileSchema>;

// A database timestamp is an opaque concurrency token; retain all fractional digits.
export const ProfileUpdateSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  displayName: z.string().trim().min(1).max(120),
  field: z.string().trim().max(160).nullable(),
  facts: z.array(StudentFactSchema.extend({
    text: z.string().trim().min(1).max(2000),
    dates: z.string().trim().max(100).nullable(),
    org: z.string().trim().max(200).nullable(),
  })).max(100),
}).superRefine((value, ctx) => {
  if (new Set(value.facts.map(f => f.id)).size !== value.facts.length)
    ctx.addIssue({ code: 'custom', path: ['facts'], message: 'Duplicate fact identifiers' });
  if (value.facts.reduce((n, f) => n + f.text.length + (f.org?.length ?? 0) + (f.dates?.length ?? 0), 0) > 30000)
    ctx.addIssue({ code: 'custom', path: ['facts'], message: 'Combined fact text exceeds 30,000 characters' });
});
