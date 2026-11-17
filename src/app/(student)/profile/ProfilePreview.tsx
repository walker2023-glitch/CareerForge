'use client';

import type { StudentProfile } from '../../../contracts';
import { StudentProfileSchema } from '../../../contracts';
import { ProfileForm } from './ProfileForm';
import { ProfileSaveError, type ProfileDraft } from './profile-model';

async function saveProfile(draft: ProfileDraft, expectedUpdatedAt: string): Promise<StudentProfile> {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, expectedUpdatedAt }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ProfileSaveError(response.status === 409 ? 'conflict' : 'unavailable');
  }

  const parsed = StudentProfileSchema.safeParse(body?.data);

  if (!parsed.success) {
    throw new ProfileSaveError('unavailable');
  }

  return parsed.data;
}

export function ProfilePreview({
  initialProfile,
  fixtureMode = false,
}: {
  initialProfile: StudentProfile;
  fixtureMode?: boolean;
}) {
  return (
    <div className="cf-profile">
        <div className="cf-profile-shell">
          <main id="main" tabIndex={-1}>
            <p className="cf-profile-eyebrow">YOUR PROFILE</p>
            <h1>Start with your story.</h1>
            <p className="cf-profile-intro">
              Build a picture of what you know, what you have done and where you want to go.
            </p>

            <aside
              className="cf-profile-notice"
              aria-label={fixtureMode ? 'Preview limitations' : 'Profile status'}
            >
              {fixtureMode ? (
                <>
                  <strong>Fictional profile preview</strong>
                  <p>
                    You are editing Maya Chen&apos;s sample profile. Changes stay on this page
                    and reset on reload. Sign-in and secure saving are not connected yet. No
                    profile text is sent to an AI service.
                  </p>
                </>
              ) : (
                <>
                  <strong>Connected profile</strong>
                  <p>
                    This profile is loaded from your Career Forge account. Changes save securely
                    to your account. Saving does not send facts to an AI service; you choose when to request résumé suggestions.
                  </p>
                </>
              )}
            </aside>

            <ProfileForm
              initialProfile={initialProfile}
              onSave={fixtureMode ? undefined : saveProfile}
            />
          </main>
        </div>
    </div>
  );
}
