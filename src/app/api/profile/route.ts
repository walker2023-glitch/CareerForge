import { NextResponse } from 'next/server';
import { ProfileUpdateSchema, StudentProfileSchema } from '../../../contracts';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { readBoundedBody, MAX_RAW_BODY_BYTES } from '../../../lib/jobs/read-bounded-body';

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await readBoundedBody(request, MAX_RAW_BODY_BYTES);
    if (!body.ok) return NextResponse.json({ error: body.message }, { status: body.status });
    let json: unknown;
    try { json = JSON.parse(body.text); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const parsed = ProfileUpdateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid profile data' }, { status: 400 });
    const { expectedUpdatedAt, displayName, field, facts } = parsed.data;
    const { data, error } = await supabase.rpc('save_student_profile', {
      p_expected_updated_at: expectedUpdatedAt, p_display_name: displayName, p_field: field, p_facts: facts,
    });
    if (error) {
      const status = error.code === '40001' ? 409 : error.code === '22023' ? 400 : error.code === '42501' ? 403 : 503;
      return NextResponse.json({ error: status === 409 ? 'Profile changed; reload before saving' : 'Unable to save profile' }, { status });
    }
    const result = StudentProfileSchema.safeParse(data);
    if (!result.success) return NextResponse.json({ error: 'Unable to read saved profile' }, { status: 503 });
    return NextResponse.json({ data: result.data });
  } catch {
    return NextResponse.json({ error: 'Profile service unavailable' }, { status: 503 });
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { data, error } = await supabase.rpc('read_student_profile');
    const result = StudentProfileSchema.safeParse(data);
    if (error || !result.success) return NextResponse.json({ error: 'Unable to load profile' }, { status: 503 });
    return NextResponse.json({ data: result.data });
  } catch {
    return NextResponse.json({ error: 'Profile service unavailable' }, { status: 503 });
  }
}
