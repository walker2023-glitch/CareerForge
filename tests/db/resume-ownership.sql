-- Trusted creation followed by ordinary-session reads/edits. All data is fictional.
begin;
insert into auth.users(id,email) values
 ('f0000000-0000-4000-8000-000000000001','sql-a@fictional.example'),
 ('f0000000-0000-4000-8000-000000000002','sql-b@fictional.example');
insert into public.jobs(id,title,company,description,source,status,created_by_user_id)
 values ('f2000000-0000-4000-8000-000000000001','Fictional job','Fictional company','Build TypeScript applications.','pasted','private','f0000000-0000-4000-8000-000000000001');
insert into public.resume_versions(id,user_id,job_id,generated_payload,fact_snapshot,edited_bullets)
 values ('f3000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',
 '{"generatedBullets":[{"id":"f4000000-0000-4000-8000-000000000001","text":"Built a TypeScript project.","evidence":["f1000000-0000-4000-8000-000000000001"],"targetsRequirement":"TypeScript"}],"match":{"jobId":"f2000000-0000-4000-8000-000000000001","matches":[],"gaps":[]}}',
 '[{"id":"f1000000-0000-4000-8000-000000000001","kind":"project","text":"Built a TypeScript project.","dates":null,"org":null}]',
 '[{"id":"f4000000-0000-4000-8000-000000000001","text":"Built a TypeScript project."}]');
set local role authenticated;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare generated jsonb; snapshot jsonb; row_count integer;
begin
 select generated_payload,fact_snapshot into generated,snapshot from public.resume_versions where id='f3000000-0000-4000-8000-000000000001';
 if not found then raise exception 'own version unavailable'; end if;
 begin
   insert into public.resume_versions(user_id) values(auth.uid());
   raise exception 'untrusted generated insert allowed';
 exception when insufficient_privilege then null; end;
 begin
   update public.resume_versions set generated_payload='{}' where id='f3000000-0000-4000-8000-000000000001';
   raise exception 'immutable generated update allowed';
 exception when insufficient_privilege then null; end;
 begin
   update public.resume_versions set job_id=null where id='f3000000-0000-4000-8000-000000000001';
   raise exception 'job retargeting allowed';
 exception when insufficient_privilege then null; end;
 update public.resume_versions set edited_bullets='[{"id":"f4000000-0000-4000-8000-000000000001","text":"Student-authored edit"}]' where id='f3000000-0000-4000-8000-000000000001';
 if not exists(select 1 from public.resume_versions where id='f3000000-0000-4000-8000-000000000001' and edited_bullets->0->>'text'='Student-authored edit' and generated_payload=generated and fact_snapshot=snapshot) then raise exception 'edit lost provenance'; end if;
 begin
   update public.resume_versions set edited_bullets='[{"id":"f4000000-0000-4000-8000-000000000099","text":"Unknown id"}]' where id='f3000000-0000-4000-8000-000000000001';
   raise exception 'foreign bullet id accepted';
 exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
 if exists(select 1 from public.resume_versions where id='f3000000-0000-4000-8000-000000000001') then raise exception 'foreign version leaked'; end if;
 update public.resume_versions set edited_bullets='[]' where id='f3000000-0000-4000-8000-000000000001';
 get diagnostics row_count = row_count;
 if row_count <> 0 then raise exception 'foreign edits allowed'; end if;
end;
$$;
rollback;
