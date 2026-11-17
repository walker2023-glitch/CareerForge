-- One write boundary for a profile and its facts. No shared data changes here.
begin;

create function public.bump_profile_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.bump_profile_version() from public, anon, authenticated;
drop trigger profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.bump_profile_version();

create function public.read_student_profile()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'userId', p.id, 'displayName', coalesce(nullif(p.display_name, ''), 'Student'),
    'field', p.field,
    -- Preserve PostgreSQL microseconds: JavaScript Date truncation breaks CAS.
    'updatedAt', to_char(p.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'facts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id, 'kind', f.kind, 'text', f.text, 'dates', f.dates, 'org', f.org
    ) order by f.created_at, f.id) from public.student_facts f where f.user_id = p.id), '[]'::jsonb)
  ) from public.profiles p where p.id = auth.uid();
$$;

create function public.save_student_profile(
  p_expected_updated_at timestamptz, p_display_name text, p_field text, p_facts jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  current_version timestamptz;
begin
  if caller is null or not public.has_role('student') then
    raise exception using errcode = '42501', message = 'Student authentication required';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 120
    or length(p_field) > 160 or p_facts is null or jsonb_typeof(p_facts) <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid profile';
  end if;
  if jsonb_array_length(p_facts) > 100 then
    raise exception using errcode = '22023', message = 'Too many facts';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_facts) as f(id uuid, kind text, text text, dates text, org text)
    where f.id is null or f.kind is null or f.kind not in ('skill','education','project','experience','interest')
      or f.text is null or length(btrim(f.text)) not between 1 and 2000
      or length(f.dates) > 100 or length(f.org) > 200
  ) or (select count(*) <> count(distinct f->>'id') from jsonb_array_elements(p_facts) f)
    or (select coalesce(sum(length(f->>'text') + coalesce(length(f->>'dates'),0) + coalesce(length(f->>'org'),0)),0) > 30000 from jsonb_array_elements(p_facts) f)
  then
    raise exception using errcode = '22023', message = 'Invalid facts';
  end if;

  -- A competing writer waits here, then compares against the committed version.
  select updated_at into current_version from public.profiles where id = caller for update;
  if not found then
    raise exception using errcode = '42501', message = 'Profile unavailable';
  end if;
  if p_expected_updated_at is null or current_version <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Profile changed; reload before saving';
  end if;
  if exists (select 1 from public.student_facts f
    join jsonb_array_elements(p_facts) v on f.id = (v->>'id')::uuid
    where f.user_id <> caller) then
    raise exception using errcode = '22023', message = 'Invalid fact identifiers';
  end if;

  update public.profiles set display_name = btrim(p_display_name), field = nullif(btrim(p_field), '') where id = caller;
  delete from public.student_facts where user_id = caller
    and id not in (select (v->>'id')::uuid from jsonb_array_elements(p_facts) v);
  insert into public.student_facts(id, user_id, kind, text, dates, org)
    select f.id, caller, f.kind::public.student_fact_kind, btrim(f.text), nullif(btrim(f.dates), ''), nullif(btrim(f.org), '')
    from jsonb_to_recordset(p_facts) as f(id uuid, kind text, text text, dates text, org text)
    on conflict (id) do update set kind = excluded.kind, text = excluded.text, dates = excluded.dates, org = excluded.org
    where public.student_facts.user_id = caller;
  return public.read_student_profile();
end;
$$;

-- Direct REST writes must not bypass the profile lock/version or split a save.
revoke insert, update on public.profiles from authenticated;
revoke insert, update, delete on public.student_facts from authenticated;
revoke all on function public.read_student_profile() from public, anon;
revoke all on function public.save_student_profile(timestamptz,text,text,jsonb) from public, anon;
grant execute on function public.read_student_profile() to authenticated;
grant execute on function public.save_student_profile(timestamptz,text,text,jsonb) to authenticated;
commit;
