-- Ordinary users may create only unverified pasted imports (including direct REST calls).
begin;
drop policy jobs_insert_own on public.jobs;
create policy jobs_insert_own on public.jobs for insert to authenticated
with check (
  created_by_user_id = auth.uid()
  and (
    (source = 'employer' and public.has_role('employer') and public.is_employer_owner(employer_id))
    or (
      source = 'pasted' and status = 'private' and employer_id is null
      and provider_name is null and external_id is null and retrieved_at is null
      and not deadline_verified and verification_status = 'unverified'
    )
  )
);
commit;
