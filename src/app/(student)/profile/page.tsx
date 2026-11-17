import { redirect } from 'next/navigation';
import { StudentProfileSchema } from '../../../contracts';
import { exampleStudent } from '../../../data/examples';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { ProfilePreview } from './ProfilePreview';
import '../../../styles/tokens.css';
import '../../../styles/components.css';
import './profile.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  if (process.env.CAREERFORGE_E2E_PROFILE_FIXTURE === '1') {
    return <ProfilePreview initialProfile={exampleStudent} fixtureMode />;
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in?next=/profile');
  }

  const { data, error } = await supabase.rpc('read_student_profile');
  if (error || !data) throw new Error('Unable to load your profile');
  const initialProfile = StudentProfileSchema.parse(data);

  return <ProfilePreview initialProfile={initialProfile} />;
}
