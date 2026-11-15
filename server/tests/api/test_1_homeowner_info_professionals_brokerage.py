import json, os, sys, struct, zlib, urllib.request, urllib.error, uuid
# Runs against the TEST Supabase project + a local backend started with `npm run dev:test`.
# Usage: python3 -I tests/api/<file> [path/to/.env.test.local]   (or: npm run test:api)
ENV_FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', '.env.test.local')
env = dict(l.strip().split('=', 1) for l in open(ENV_FILE) if '=' in l and not l.startswith('#'))
if 'gfeeiyjhjapysiqxwiqi' in env['SUPABASE_URL']:
    sys.exit('Refusing to run API tests against the LIVE project')
SB, ANON, SVC = env['SUPABASE_URL'], env['SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
API = os.environ.get('API_URL', 'http://localhost:3001/api')
ok = fail = 0
def call(method, url, token=None, body=None, apikey=None, raw=None, ctype='application/json'):
    h = {}
    if body is not None or raw is None: h['Content-Type'] = ctype
    if raw is not None: h['Content-Type'] = ctype
    if token: h['Authorization'] = 'Bearer ' + token
    if apikey: h['apikey'] = apikey
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, method=method, headers=h, data=data)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t or 'null')
        except Exception: return e.code, t[:200]
def login(email):
    s, d = call('POST', f'{SB}/auth/v1/token?grant_type=password', body={'email': email, 'password': 'SonderDemo-2026'}, apikey=ANON)
    return d['access_token']
def check(name, cond, extra=''):
    global ok, fail
    if cond: ok += 1; print('PASS', name)
    else: fail += 1; print('FAIL', name, extra)
def multipart(field, filename, content, ctype):
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n').encode() + content + f'\r\n--{b}--\r\n'.encode()
    return body, f'multipart/form-data; boundary={b}'
def png1x1():
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00\x1e\x3a\x5f')) + chunk(b'IEND', b'')

home, agent, broker, priya, legal, docs_home = [login(e) for e in ['home.new@example.com','pro.agent@example.com','pro.broker@example.com','pro.harbor@example.com','pro.legal@example.com','home.docs@example.com']]

# --- My Information
s, d = call('GET', f'{API}/me', home)
check('GET /me creates self household row', s == 200 and len(d['household']) == 1 and d['household'][0]['is_self'], d)
s, _ = call('GET', f'{API}/me', agent)
check('/me is homeowner-only', s == 403)
base = {'full_name': 'Linda Park', 'phone': '(213) 555-0101', 'property_street': '9 Test Ln', 'property_city': 'Los Angeles', 'property_zip': 'abc', 'property_county': 'Los Angeles', 'mailing_same': True, 'hardship_reasons': ['job_loss']}
s, d = call('PUT', f'{API}/me/info', home, base)
check('bad ZIP rejected', s == 400)
s, d = call('PUT', f'{API}/me/info', home, {**base, 'hardship_reasons': ['bogus']})
check('bad hardship reason rejected', s == 400)
s, d = call('PUT', f'{API}/me/info', home, {**base, 'property_zip': '90001', 'mailing_street': 'ignored', 'servicer_name': 'Test Servicing'})
check('info saved, mailing cleared when same', s == 200 and d['property_zip'] == '90001' and d['mailing_street'] is None, d)
s, d = call('POST', f'{API}/me/emails', home, {'email': 'home.new@example.com', 'label': 'other'})
check('main email cannot be added again', s == 409)
s, e1 = call('POST', f'{API}/me/emails', home, {'email': 'linda.work@example.com', 'label': 'work'})
check('extra email added', s == 201)
s, _ = call('POST', f'{API}/me/emails', home, {'email': 'LINDA.WORK@example.com', 'label': 'work'})
check('duplicate email rejected (case-insensitive)', s == 409)
s, _ = call('POST', f'{API}/me/emails', home, {'email': 'not-an-email'})
check('invalid email rejected', s == 400)
s, d = call('GET', f'{API}/me', home)
self_id = d['household'][0]['id']
s, d = call('PUT', f'{API}/me/household/{self_id}', home, {'full_name': 'Linda Park', 'relationship': 'self', 'income_types': ['employment'], 'employer': 'City Hospital'})
check('self income saved', s == 200 and d['income_types'] == ['employment'] and d['employer'] == 'City Hospital', d)
s, sp = call('POST', f'{API}/me/household', home, {'full_name': 'Tom Park', 'relationship': 'spouse', 'on_mortgage': True, 'income_types': ['social_security']})
check('spouse added', s == 201)
s, kid = call('POST', f'{API}/me/household', home, {'full_name': 'Amy Park', 'relationship': 'child', 'income_types': ['employment'], 'employer': 'Cafe'})
check('adult child added', s == 201)
s, _ = call('POST', f'{API}/me/household', home, {'full_name': 'X', 'relationship': 'self', 'income_types': []})
check('cannot add a second self', s == 400)
s, _ = call('DELETE', f'{API}/me/household/{self_id}', home)
check('cannot delete self', s == 404)
s, d = call('GET', f'{API}/me/documents', home)
labels = [x['label'] for x in d['documents']]
check('preview: pay stubs w/ employer, SS letter, contribution letter for non-borrower',
      any('Your pay stubs' in l and 'City Hospital' in l for l in labels) and any("Tom's Social Security" in l for l in labels)
      and any("Amy's signed letter" in l for l in labels) and not any("Tom's signed letter" in l for l in labels), labels)
s, t = call('POST', f'{API}/me/team', home, {'role': 'attorney', 'name': 'Sarah Kim', 'status': 'consultation'})
check('lawyer added to team', s == 201 and t['status'] == 'consultation')
s, _ = call('POST', f'{API}/me/team', home, {'role': 'attorney', 'name': 'X', 'email': 'bad'})
check('team bad email rejected', s == 400)

# --- Directory + two professionals
s, d = call('GET', f'{API}/directory?county=Los%20Angeles', home)
pros = d['professionals']; by = {p['full_name']: p for p in pros}
check('directory has 7 LA pros incl. Priya (brokerage-covered) and Gina (grace), not Leo (read-only)', len(pros) == 7 and 'Leo Park' not in by and 'Priya Shah' in by, [p['full_name'] for p in pros])
check('Priya shows Harbor brokerage', (by['Priya Shah'].get('brokerage') or {}).get('name') == 'Harbor Brokerage Group')
pick = {'county': 'Los Angeles', 'situation': 'notice', 'contact_name': 'Linda Park', 'consent': True}
s, d = call('POST', f'{API}/match', home, {**pick, 'professional_id': by['Maria Lopez']['id']})
check('pick real estate agent', s == 201 and d['category'] == 'real_estate', d)
s, d = call('POST', f'{API}/match', home, {**pick, 'professional_id': by['David Chen']['id']})
check('second real estate pro blocked', s == 409)
s, d = call('POST', f'{API}/match', home, {**pick, 'professional_id': by['James Carter']['id']})
check('legal professional allowed alongside', s == 201 and d['category'] == 'legal', d)
s, d = call('POST', f'{API}/match', home, {**pick, 'professional_id': by['Sarah Kim']['id']})
check('attorney still direct-contact only', s == 400)
s, m = call('GET', f'{API}/match', home)
active = [c for c in m['cases'] if c['request']['status'] == 'claimed']
check('homeowner sees 2 active cases', len(active) == 2, [c['category'] for c in m['cases']])

# --- Professional sees homeowner info and builds docs from household
s, d = call('GET', f'{API}/leads', agent)
lead = next(c for c in d['mine'] if c['contact_name'] == 'Linda Park')
check('pro sees homeowner info (consented)', lead['homeowner'] and lead['homeowner']['info']['servicer_name'] == 'Test Servicing'
      and len(lead['homeowner']['household']) == 3 and lead['homeowner']['emails'][0]['email'] == 'linda.work@example.com', lead.get('homeowner'))
s, d = call('POST', f'{API}/leads/{lead["id"]}/documents', agent, {'fromHousehold': True})
types = {x['doc_type'] for x in d} if s == 201 else set()
check('documents built from household with types', s == 201 and {'pay_stub', 'benefit_letter', 'contribution_letter', 'irs_4506c'} <= types and any(x['label'].startswith("Linda's pay stubs") for x in d), d)
s, _ = call('POST', f'{API}/leads/{lead["id"]}/documents', agent, {'fromHousehold': True})
check('rebuilding adds nothing new', s == 409)
s, d = call('POST', f'{API}/leads/{lead["id"]}/documents', agent, {'label': 'Last W-2'})
check('typed label gets a guessed type', s == 201 and d[0]['doc_type'] == 'tax_return')
s, m = call('GET', f'{API}/match', home)
re_case = next(c for c in m['cases'] if c['category'] == 'real_estate')
doc = re_case['documents'][0]
s, x = call('PATCH', f'{API}/match/documents/{doc["id"]}', home, {'sent': True})
check('homeowner marks doc sent on one of two cases', s == 200 and x['doc_type'], x)
s, x = call('PATCH', f'{API}/match/documents/{doc["id"]}', docs_home, {'sent': True})
check("another homeowner can't touch it", s == 404)

# --- Brokerage
s, d = call('GET', f'{API}/brokerage', broker)
check('broker is owner with Priya + 1 invite', s == 200 and d['role'] == 'owner' and [a['full_name'] for a in d['agents']] == ['Priya Shah'] and len(d['invites']) == 1, d)
s, d = call('GET', f'{API}/brokerage', priya)
check('Priya is member', s == 200 and d['role'] == 'member')
s, _ = call('GET', f'{API}/leads', priya)
check("Priya has access via broker's subscription", s == 200)
s, _ = call('POST', f'{API}/brokerage/invites', priya, {'email': 'x@example.com'})
check('member cannot invite', s == 403)
s, _ = call('POST', f'{API}/brokerage', agent, {'name': 'Nope'})
check('non-broker cannot create brokerage', s == 403)
s, inv = call('POST', f'{API}/brokerage/invites', broker, {'email': 'join.test@example.com'})
check('broker creates invite', s == 201 and len(inv['token']) > 20)
s, d = call('POST', f'{API}/brokerage/join', home, {'token': inv['token']})
check('wrong account cannot use invite', s == 403)
s, u = call('POST', f'{SB}/auth/v1/admin/users', SVC, {'email': 'join.test@example.com', 'password': 'SonderDemo-2026', 'email_confirm': True}, apikey=SVC)
jt = login('join.test@example.com')
s, d = call('GET', f'{API}/brokerage/invite/{inv["token"]}', jt)
check('invite preview matches email', s == 200 and d['email_matches'] and d['brokerage']['name'] == 'Harbor Brokerage Group', d)
s, _ = call('GET', f'{API}/leads', jt)
check('before joining: no pro access', s == 403)
s, d = call('POST', f'{API}/brokerage/join', jt, {'token': inv['token']})
check('join ok', s == 200, d)
s, _ = call('POST', f'{API}/brokerage/join', jt, {'token': inv['token']})
check('invite cannot be reused', s == 404)
s, _ = call('GET', f'{API}/leads', jt)
check('after joining: pro access (role cache invalidated)', s == 200)
s, d = call('GET', f'{API}/brokerage', broker)
newid = next(a['id'] for a in d['agents'] if a['email'] == 'join.test@example.com')
s, _ = call('DELETE', f'{API}/brokerage/agents/{newid}', broker)
s, _ = call('GET', f'{API}/leads', jt)
check('removed agent loses access', s == 403)
s, d = call('GET', f'{API}/brokerage/clients', broker)
check('broker team view lists team clients', s == 200 and any(c['contact_name'] == 'Michael Nguyen' and c['agent_is_me'] for c in d['clients']), d)
s, _ = call('GET', f'{API}/brokerage/clients', priya)
check('member cannot see team clients', s == 403)

# --- Images
body, ct = multipart('file', 'me.png', png1x1(), 'image/png')
s, d = call('POST', f'{API}/leads/avatar', agent, raw=body, ctype=ct)
check('avatar upload (real PNG)', s == 200 and d['avatar_url'].startswith('http'), d)
if s == 200:
    r = urllib.request.urlopen(d['avatar_url']); check('avatar publicly readable', r.status == 200 and r.read()[:4] == b'\x89PNG')
body, ct = multipart('file', 'evil.png', b'<script>alert(1)</script>', 'image/png')
s, _ = call('POST', f'{API}/leads/avatar', agent, raw=body, ctype=ct)
check('fake PNG rejected', s == 400)
body, ct = multipart('file', 'logo.png', png1x1(), 'image/png')
s, d = call('POST', f'{API}/brokerage/logo', broker, raw=body, ctype=ct)
check('brokerage logo upload', s == 200 and d['logo_url'])
s, d = call('GET', f'{API}/directory?county=Los%20Angeles', home)
p2 = {p['full_name']: p for p in d['professionals']}
check('directory shows avatar + brokerage logo', p2['Maria Lopez']['avatar_url'] and p2['Priya Shah']['brokerage']['logo_url'])

# --- Withdraw one case keeps the other
s, m = call('GET', f'{API}/match', home)
legal_case = next(c for c in m['cases'] if c['category'] == 'legal')
s, _ = call('DELETE', f'{API}/match/{legal_case["request"]["id"]}', home)
s, m = call('GET', f'{API}/match', home)
st = {c['category']: c['request']['status'] for c in m['cases']}
check('withdraw legal keeps real estate', st == {'real_estate': 'claimed', 'legal': 'withdrawn'}, st)
s, d = call('GET', f'{API}/leads', legal)
w = next(c for c in d['mine'] if c['contact_name'] == 'Linda Park')
check('withdrawn: pro loses homeowner info', w['homeowner'] is None and w['contact_email'] is None)
print(f'\n{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
