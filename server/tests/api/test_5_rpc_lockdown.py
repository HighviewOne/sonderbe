import json, os, re, sys, glob, uuid, urllib.request, urllib.error
# Every database function must be blocked for the publishable key and for logged-in users.
# Postgres lets EVERYONE execute a new function unless it is revoked, and Supabase exposes
# public-schema functions at /rest/v1/rpc/<name>, so a missing REVOKE is an open door that
# skips the backend's authorization entirely.
# Also flags functions that exist in the test database but in no SQL file in the repo.
# Runs against the TEST Supabase project (no backend needed, but run.sh expects one).
# Usage: python3 -I tests/api/test_5_rpc_lockdown.py [path/to/.env.test.local]   (or: npm run test:api)
HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '.env.test.local')
env = dict(l.strip().split('=', 1) for l in open(ENV_FILE) if '=' in l and not l.startswith('#'))
if 'gfeeiyjhjapysiqxwiqi' in env['SUPABASE_URL']:
    sys.exit('Refusing to run API tests against the LIVE project')
SB, ANON, SVC = env['SUPABASE_URL'], env['SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
REPO = os.path.join(HERE, '..', '..', '..')
ok = fail = 0

def call(method, url, apikey, token=None, body=None, accept='application/json'):
    h = {'apikey': apikey, 'Content-Type': 'application/json', 'Accept': accept}
    if token: h['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, headers=h, data=data)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t or 'null')
        except Exception: return e.code, t[:200]

def check(name, cond, extra=''):
    global ok, fail
    if cond: ok += 1; print('PASS', name)
    else: fail += 1; print('FAIL', name, extra)

# --- Functions declared in the repo's SQL files: name -> (arg names/types, return type)
DUMMY = {'uuid': lambda: str(uuid.uuid4()), 'text': lambda: 'none', 'boolean': lambda: False,
         'integer': lambda: 0, 'int': lambda: 0, 'bigint': lambda: 0, 'numeric': lambda: 0}
declared = {}
sql_files = glob.glob(os.path.join(REPO, 'supabase', '*.sql')) + glob.glob(os.path.join(REPO, 'server', 'migrations', '*.sql'))
for path in sql_files:
    sql = open(path).read()
    for m in re.finditer(r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(([^)]*)\)\s*RETURNS\s+(\w+)', sql, re.I):
        name, raw_args, returns = m.group(1), m.group(2), m.group(3).lower()
        args = [a.split()[:2] for a in raw_args.split(',') if a.strip()]
        declared[name] = (args, returns, os.path.basename(path))

callable_fns = {n: v for n, v in declared.items() if v[1] != 'trigger'}
check('found the repo functions to test', len(callable_fns) >= 2, sorted(declared))

s, d = call('POST', f'{SB}/auth/v1/token?grant_type=password', ANON, body={'email': 'home.new@example.com', 'password': 'SonderDemo-2026'})
user_token = d.get('access_token') if isinstance(d, dict) else None
check('logged in as a demo homeowner', bool(user_token), d)

for name, (args, returns, src) in sorted(callable_fns.items()):
    missing = [t for _, t in args if t.lower() not in DUMMY]
    if missing:
        check(f'{name}: knows how to fill its arguments', False, f'add {missing} to DUMMY')
        continue
    body = {a: DUMMY[t.lower()]() for a, t in args}
    url = f'{SB}/rest/v1/rpc/{name}'
    s, d = call('POST', url, ANON, body=body)
    check(f'{name} ({src}): blocked for the publishable key', s in (401, 403) and isinstance(d, dict) and d.get('code') == '42501',
          f'{s} {d} -> add REVOKE EXECUTE ON FUNCTION {name}(...) FROM PUBLIC, anon, authenticated;')
    if user_token:
        s, d = call('POST', url, ANON, token=user_token, body=body)
        check(f'{name}: blocked for a logged-in user', s in (401, 403) and isinstance(d, dict) and d.get('code') == '42501', f'{s} {d}')
    # The backend's key must still reach it with these arguments, or the checks above prove nothing
    # (a wrong argument list gives PGRST202 "function not found", which would also look "blocked").
    # Dummy ids match no rows, so these calls change nothing.
    s, d = call('POST', url, SVC, body=body)
    check(f'{name}: still callable by the backend (test is calling it correctly)', s < 300, f'{s} {d}')

# --- Functions in the database that no SQL file in the repo creates
s, d = call('GET', f'{SB}/rest/v1/', SVC, accept='application/openapi+json')
if s == 200 and isinstance(d, dict):
    live_fns = {p[len('/rpc/'):] for p in d.get('paths', {}) if p.startswith('/rpc/')}
    stray = sorted(live_fns - set(declared))
    check('every database function is created by a SQL file in the repo', not stray,
          f'{stray} exist only in the database: add them to a migration (with a REVOKE)')
else:
    print('SKIP database function listing (OpenAPI not available to the secret key):', s)

print(f'{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
