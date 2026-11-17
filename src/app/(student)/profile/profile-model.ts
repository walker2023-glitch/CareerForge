import { StudentFactSchema, StudentProfileSchema, type StudentFact, type StudentProfile } from '../../../contracts';

export type ProfileDraft = Pick<StudentProfile, 'displayName' | 'field' | 'facts'>;
export type DraftValidation = { success: true; data: ProfileDraft } | { success: false; errors: Record<string, string> };
export const PROFILE_LIMITS = { name: 120, field: 160, facts: 100, totalFactCharacters: 30000, organization: 200, dates: 100 } as const;
const EditableProfileSchema = StudentProfileSchema.pick({ displayName: true, field: true, facts: true });
const nullableText = (text: string | null) => text?.trim() || null;

// Frontend validation only. Server authorization/ownership is enforced by the profile RPC.
export function validateProfileDraft(draft: ProfileDraft): DraftValidation {
  const errors: Record<string, string> = {};
  if (draft.displayName.length > PROFILE_LIMITS.name) errors.displayName = 'Use 120 characters or fewer for your name.';
  if ((draft.field?.length ?? 0) > PROFILE_LIMITS.field) errors.field = 'Use 160 characters or fewer for your career field.';
  if (draft.facts.length > PROFILE_LIMITS.facts) errors.facts = 'Keep up to 100 experience entries.';
  let characters = 0;
  const ids = new Set<string>();
  draft.facts.forEach((fact, index) => {
    if (fact.text.length > 2000) errors[`facts.${index}.text`] = 'Use 2,000 characters or fewer for this entry.';
    characters += fact.text.length + (fact.org?.length ?? 0) + (fact.dates?.length ?? 0);
    if (ids.has(fact.id)) errors.facts = 'An experience entry was duplicated. Remove the duplicate and try again.';
    ids.add(fact.id);
    if ((fact.org?.length ?? 0) > PROFILE_LIMITS.organization) errors[`facts.${index}.org`] = 'Use 200 characters or fewer.';
    if ((fact.dates?.length ?? 0) > PROFILE_LIMITS.dates) errors[`facts.${index}.dates`] = 'Use 100 characters or fewer.';
  });
  if (characters > PROFILE_LIMITS.totalFactCharacters) errors.facts = 'Keep your combined experience text to 30,000 characters or fewer.';
  if (Object.keys(errors).length) return { success: false, errors };
  const parsed = EditableProfileSchema.safeParse({
    displayName: draft.displayName.trim(), field: nullableText(draft.field),
    facts: draft.facts.map(fact => ({ ...fact, text: fact.text.trim(), org: nullableText(fact.org), dates: nullableText(fact.dates) })),
  });
  if (!parsed.success) {
    parsed.error.issues.forEach(issue => {
      const key = issue.path.join('.');
      errors[key] = key === 'displayName' ? 'Enter your display name.' : key.endsWith('.text') ? 'Describe this experience or remove the empty entry.' : 'Check this value and try again.';
    });
    return { success: false, errors };
  }
  return { success: true, data: parsed.data };
}

export function addFact(draft: ProfileDraft, kind: StudentFact['kind'], id: string): ProfileDraft {
  if (draft.facts.some(fact => fact.id === id)) throw new Error('This experience id already exists.');
  if (draft.facts.length >= PROFILE_LIMITS.facts) throw new Error('Keep up to 100 experience entries.');
  StudentFactSchema.shape.id.parse(id);
  StudentFactSchema.shape.kind.parse(kind);
  return { ...draft, facts: [...draft.facts, { id, kind, text: '', dates: null, org: null }] };
}
export function updateFact(draft: ProfileDraft, id: string, patch: Partial<Omit<StudentFact, 'id'>>): ProfileDraft {
  return { ...draft, facts: draft.facts.map(fact => fact.id === id ? { ...fact, ...patch, id: fact.id } : fact) };
}
export function removeFact(draft: ProfileDraft, id: string): ProfileDraft {
  return { ...draft, facts: draft.facts.filter(fact => fact.id !== id) };
}

export class ProfileSaveError extends Error {
  constructor(public readonly code: 'conflict' | 'unavailable') { super(code); }
}
