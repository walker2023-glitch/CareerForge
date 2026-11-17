-- Career Forge follow-up security and integrity fixes.
-- Apply after 20261113200000_career_forge_initial.sql.
-- This migration is safe for an existing database only after reviewing existing
-- rows against the new constraints.

begin;

-- Generated résumé payloads and fact snapshots must be created by the
-- server-side generation path, not directly by an authenticated browser client.
revoke insert on public.resume_versions from authenticated;

do $$
begin
if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_job_type_check') then
  alter table public.jobs add constraint jobs_job_type_check
  check (job_type in ('internship', 'full_time', 'part_time', 'co_op', 'contract', 'unknown'));
end if;

if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_work_mode_check') then
  alter table public.jobs add constraint jobs_work_mode_check
  check (work_mode in ('remote', 'hybrid', 'on_site', 'unknown'));
end if;

if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'job_deadline_verification_check') then
  alter table public.jobs add constraint job_deadline_verification_check
  check (
    (deadline_verified and verification_status = 'verified')
    or (not deadline_verified and verification_status <> 'verified')
  );
end if;

end;
$$;

drop policy if exists jobs_update_own on public.jobs;

create policy jobs_update_own on public.jobs for update to authenticated
  using (
    created_by_user_id = auth.uid()
    and (
      source <> 'employer'
      or public.is_employer_owner(employer_id)
    )
  )
  with check (
    created_by_user_id = auth.uid()
    and (
      (source = 'employer' and public.has_role('employer') and public.is_employer_owner(employer_id))
      or (source <> 'employer' and employer_id is null and status = 'private')
    )
  );

create or replace function public.get_employer_stats()
returns table (job_id uuid, unique_viewers bigint, current_saves bigint)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select j.id,
    (select count(*) from public.job_views v where v.job_id = j.id),
    (select count(*) from public.saved_applications sa where sa.job_id = j.id)
  from public.jobs j
  where public.has_role('employer')
    and j.source = 'employer'
    and public.is_employer_owner(j.employer_id);
$$;

commit;
