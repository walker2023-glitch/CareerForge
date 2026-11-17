-- Execute only in the disposable local Supabase database. Everything rolls back.
begin;
insert into auth.users(id, email) values
  ('f0000000-0000-4000-8000-000000000001', 'sql-a@fictional.example'),
  ('f0000000-0000-4000-8000-000000000002', 'sql-b@fictional.example');
create function pg_temp.reject_test_fact() returns trigger language plpgsql as $$
begin
  if new.text = '[injected failure]' then raise exception 'injected write failure'; end if;
  return new;
end;
$$;
create trigger test_reject_fact before insert or update on public.student_facts
  for each row execute function pg_temp.reject_test_fact();
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
declare
  original jsonb;
  saved jsonb;
  current_snapshot jsonb;
  facts jsonb := '[{"id":"f1000000-0000-4000-8000-000000000001","kind":"skill","text":"Fictional SQL fact","dates":null,"org":null}]';
begin
  original := public.read_student_profile();
  saved := public.save_student_profile((original->>'updatedAt')::timestamptz, 'Fictional SQL A', null, facts);
  if saved->>'displayName' <> 'Fictional SQL A' or jsonb_array_length(saved->'facts') <> 1 then raise exception 'save did not persist'; end if;
  begin
    perform public.save_student_profile((original->>'updatedAt')::timestamptz, 'stale overwrite', null, '[]');
    raise exception 'stale write accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_student_profile((saved->>'updatedAt')::timestamptz, 'partial profile', null,
      '[{"id":"f1000000-0000-4000-8000-000000000002","kind":"skill","text":"[injected failure]","dates":null,"org":null}]');
    raise exception 'injected failure was ignored';
  exception when raise_exception then
    if sqlerrm <> 'injected write failure' then raise; end if;
  end;
  if public.read_student_profile() <> saved then raise exception 'partial save escaped rollback'; end if;
  begin
    update public.profiles set display_name = 'bypass';
    raise exception 'direct profile write allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.student_facts;
    raise exception 'direct fact write allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000002', true);
  if exists (select 1 from public.student_facts where id = 'f1000000-0000-4000-8000-000000000001') then raise exception 'foreign fact leaked'; end if;
  original := public.read_student_profile();
  begin
    perform public.save_student_profile((original->>'updatedAt')::timestamptz, 'stolen fact', null, facts);
    raise exception 'foreign fact accepted';
  exception when invalid_parameter_value then null; end;
  if public.read_student_profile() <> original then raise exception 'foreign fact failure changed profile'; end if;
end;
$$;
rollback;
