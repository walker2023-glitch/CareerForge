-- Disposable local PostgreSQL only; two fictional principals, all writes rolled back.
begin;
insert into auth.users(id,email) values
 ('f0000000-0000-4000-8000-000000000001','sql-a@fictional.example'),
 ('f0000000-0000-4000-8000-000000000002','sql-b@fictional.example');
set local role authenticated;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.jobs(id,title,company,description,source,status,created_by_user_id)
 values ('f2000000-0000-4000-8000-000000000001','Fictional job','Fictional company','Build TypeScript applications.','pasted','private','f0000000-0000-4000-8000-000000000001');
do $$
begin
 if not exists (select 1 from public.jobs where id='f2000000-0000-4000-8000-000000000001' and source='pasted' and status='private' and not deadline_verified) then raise exception 'own saved job unavailable'; end if;
 begin
   insert into public.jobs(title,company,description,source,status,created_by_user_id)
     values ('forged owner','Fictional','text','pasted','private','f0000000-0000-4000-8000-000000000002');
   raise exception 'foreign ownership accepted';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.jobs(title,company,description,source,status,created_by_user_id,deadline_verified,verification_status)
     values ('forged verification','Fictional','text','pasted','private',auth.uid(),true,'verified');
   raise exception 'forged verification accepted';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.jobs(title,company,description,source,status,created_by_user_id,provider_name)
     values ('forged provider','Fictional','text','provider','private',auth.uid(),'fictional');
   raise exception 'forged provider accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
 if exists (select 1 from public.jobs where id='f2000000-0000-4000-8000-000000000001') then raise exception 'foreign private job leaked'; end if;
end;
$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
 begin
   perform * from public.jobs;
   raise exception 'anonymous read grant exists';
 exception when insufficient_privilege then null; end;
end;
$$;
rollback;
