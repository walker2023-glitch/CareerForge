"""Two actual PostgreSQL connections; disposable local container only.
Creates fictional rows in that isolated database and deliberately retains them.
This proves transaction/CAS behavior, not Supabase Auth or HTTP cookies.
"""
import concurrent.futures
import json
import subprocess
import sys
import uuid

container = sys.argv[1]
if container != 'careerforge_sql_verify' and not container.startswith('supabase_db_'):
    raise SystemExit('Only an explicitly named local test container is supported')
user_id = str(uuid.uuid4())

def sql(statement):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, capture_output=True)
    return result

def own(statement):
    return sql(f"set role authenticated; set request.jwt.claim.sub = '{user_id}'; set request.jwt.claim.role = 'authenticated'; " + statement)

created = sql(f"insert into auth.users(id,email) values ('{user_id}','concurrency-{user_id}@fictional.example');")
if created.returncode:
    raise SystemExit('Could not create fictional local principal')
initial = own('select public.read_student_profile();')
if initial.returncode:
    raise SystemExit('Could not read fictional local profile')
version = json.loads(initial.stdout)['updatedAt']

def write(name):
    # Keep the successful transaction open briefly so the other writer must wait.
    return own(f"begin; select public.save_student_profile('{version}', '{name}', null, '[]'); select pg_sleep(0.2); commit;")

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    outcomes = list(pool.map(write, ['Fictional concurrent A', 'Fictional concurrent B']))
assert sorted(r.returncode == 0 for r in outcomes) == [False, True], 'Expected one success and one conflict'
failure = next(r for r in outcomes if r.returncode)
assert 'Profile changed; reload before saving' in failure.stderr, 'Unexpected database failure'
reloaded = own('select public.read_student_profile();')
assert reloaded.returncode == 0
saved = json.loads(reloaded.stdout)
assert saved['displayName'] in ['Fictional concurrent A', 'Fictional concurrent B']
assert saved['updatedAt'] != version
assert saved['facts'] == []
print('PASS: two connections produced one committed save and one stale conflict; fresh connection retained the winner.')
