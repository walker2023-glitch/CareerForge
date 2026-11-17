begin;
-- The browser/session can edit only its authored text, never identity or provenance.
revoke update on public.resume_versions from authenticated;
grant update (edited_bullets) on public.resume_versions to authenticated;

create function public.validate_resume_edits()
returns trigger language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(new.edited_bullets) <> 'array' then
    raise exception using errcode = '22023', message = 'Invalid edited bullets';
  end if;
  if jsonb_array_length(new.edited_bullets) > 10 or exists (
    select 1 from jsonb_array_elements(new.edited_bullets) b
    where jsonb_typeof(b->'text') <> 'string' or b->>'text' is null or length(b->>'text') > 2000
      or not exists (select 1 from jsonb_array_elements(new.generated_payload->'generatedBullets') g where g->>'id' = b->>'id')
  ) or (select count(*) <> count(distinct b->>'id') from jsonb_array_elements(new.edited_bullets) b) then
    raise exception using errcode = '22023', message = 'Invalid edited bullets';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_resume_edits() from public, anon, authenticated;
create trigger resume_versions_validate_edits before insert or update on public.resume_versions
  for each row execute function public.validate_resume_edits();
commit;
