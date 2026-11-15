import json, os, sys, urllib.request, urllib.error
# Runs against the TEST Supabase project + a local backend started with `npm run dev:test`.
# Usage: python3 -I tests/api/<file> [path/to/.env.test.local]   (or: npm run test:api)
ENV_FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', '.env.test.local')
env = dict(l.strip().split('=', 1) for l in open(ENV_FILE) if '=' in l and not l.startswith('#'))
if 'gfeeiyjhjapysiqxwiqi' in env['SUPABASE_URL']:
    sys.exit('Refusing to run API tests against the LIVE project')
SB, ANON = env['SUPABASE_URL'], env['SUPABASE_ANON_KEY']
API = os.environ.get('API_URL', 'http://localhost:3001/api')
ok = fail = 0
def call(method, url, token=None, body=None, apikey=None):
    h = {'Content-Type': 'application/json'}
    if token: h['Authorization'] = 'Bearer ' + token
    if apikey: h['apikey'] = apikey
    req = urllib.request.Request(url, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t or 'null')
        except ValueError: return e.code, {'error': t.decode(errors='replace')[:200]}
def login(email):
    return call('POST', f'{SB}/auth/v1/token?grant_type=password', body={'email': email, 'password': 'SonderDemo-2026'}, apikey=ANON)[1]['access_token']
def check(name, cond, extra=''):
    global ok, fail
    if cond: ok += 1; print('PASS', name)
    else: fail += 1; print('FAIL', name, extra)

maria, david, angela, robert = [login(e) for e in ['pro.agent@example.com', 'pro.broker@example.com', 'home.docs@example.com', 'home.matched@example.com']]

# Dashboard summary
s, d = call('GET', f'{API}/leads/summary', maria)
by = {c['contact_name']: c for c in d['clients']}
check('summary: Maria has Robert + Angela', s == 200 and set(by) == {'Robert Diaz', 'Angela Brooks'}, d)
check('summary: Robert 1 to review, 1 unread', by['Robert Diaz']['to_review'] == 1 and by['Robert Diaz']['unread_notes'] == 1, by['Robert Diaz'])
check('summary: Angela 1 due, 1 to review, 2 unread', by['Angela Brooks']['due_for_update'] == 1 and by['Angela Brooks']['to_review'] == 1 and by['Angela Brooks']['unread_notes'] == 2, by['Angela Brooks'])

# Professional My Information
s, d = call('GET', f'{API}/leads/info', maria)
check('pro info loads with office', s == 200 and d['info']['document_email'] == 'docs.lopez@example.com')
base = {**d['info'], 'full_name': 'Maria Lopez', 'phone': '(213) 555-0141'}
s, _ = call('PUT', f'{API}/leads/info', maria, {**base, 'office_zip': '9110'})
check('bad ZIP rejected', s == 400)
s, _ = call('PUT', f'{API}/leads/info', maria, {**base, 'fax': '123'})
check('bad fax rejected', s == 400)
s, _ = call('PUT', f'{API}/leads/info', maria, {**base, 'document_email': 'nope'})
check('bad document email rejected', s == 400)
s, d = call('PUT', f'{API}/leads/info', maria, {**base, 'office_hours': 'Mon–Fri 8–5'})
check('pro info saved', s == 200 and d['office_hours'] == 'Mon–Fri 8–5')
s, _ = call('GET', f'{API}/leads/info', angela)
check('homeowner cannot use pro info', s == 403)
s, m = call('GET', f'{API}/match', angela)
c = next(x for x in m['cases'] if x['request']['status'] == 'claimed')
check('homeowner sees pro office + how to send', c['professional']['office']['document_email'] == 'docs.lopez@example.com' and c['professional']['office']['office_hours'] == 'Mon–Fri 8–5')

# Rounds, expiry, history
s, d = call('GET', f'{API}/leads', maria)
ang = next(x for x in d['mine'] if x['contact_name'] == 'Angela Brooks')
cid = ang['id']
docs = {x['doc_type']: x for x in ang['documents']}
check('bank statement is due for update (40 days, good for 30)', docs['bank_statement']['stale'] and docs['bank_statement']['expires_on'])
check('tax returns on round 2 with reason', docs['tax_return']['round'] == 2 and 'Schedule 1' in docs['tax_return']['request_reason'])
s, upd = call('POST', f'{API}/leads/{cid}/documents/request-updates', maria)
check('request updates re-requests the stale doc', s == 200 and len(upd) == 1 and upd[0]['round'] == 2 and upd[0]['received_at'] is None and upd[0]['last_received_at'], upd)
s, _ = call('POST', f'{API}/leads/{cid}/documents/request-updates', maria)
check('nothing left due → 409', s == 409)
mort = docs['mortgage_statement']['id']
s, _ = call('POST', f'{API}/leads/{cid}/documents/{mort}/request-again', maria, {'reason': ''})
check('request again needs a reason', s == 400)
s, d = call('POST', f'{API}/leads/{cid}/documents/{mort}/request-again', maria, {'reason': "This month's copy, please"})
check('request again → round 2, cleared', s == 200 and d['round'] == 2 and d['sent_at'] is None and d['received_at'] is None)
s, _ = call('POST', f'{API}/leads/{cid}/documents/{mort}/request-again', david, {'reason': 'x'})
check("another pro can't request on Maria's case", s == 404)
s, m = call('GET', f'{API}/match', angela)
c = next(x for x in m['cases'] if x['request']['status'] == 'claimed')
md = next(x for x in c['documents'] if x['id'] == mort)
check('homeowner sees the reason', md['request_reason'] == "This month's copy, please" and md['round'] == 2)
s, x = call('PATCH', f'{API}/match/documents/{mort}', angela, {'sent': True, 'note': 'Emailed the November statement'})
check('homeowner sends round 2', s == 200 and x['sent_at'])
s, x = call('PATCH', f'{API}/leads/{cid}/documents/{mort}', maria, {'received': True})
check('pro marks round 2 received', s == 200 and x['received_at'] and not x['stale'])
s, x = call('PATCH', f'{API}/match/documents/{mort}', angela, {'sent': False})
check("homeowner can't unsend a received doc", s == 404)
s, h = call('GET', f'{API}/leads/{cid}/documents/{mort}/history', maria)
acts = [(e['round'], e['action']) for e in h['history']]
check('history records round 2 actions', (2, 'requested_again') in acts and (2, 'sent') in acts and (2, 'received') in acts, acts)
s, _ = call('PATCH', f'{API}/leads/{cid}/documents/{mort}', maria, {'refresh_days': 0})
check('refresh 0 days rejected', s == 400)
s, x = call('PATCH', f'{API}/leads/{cid}/documents/{mort}', maria, {'refresh_days': 45})
check('refresh period set', s == 200 and x['refresh_days'] == 45)
s, d = call('POST', f'{API}/leads/{cid}/documents', maria, {'label': 'Last 2 months of business bank statements'})
check('new bank statement doc gets 30-day default', s == 201 and d[0]['refresh_days'] == 30)

# Notes
s, m = call('GET', f'{API}/match', angela)
c = next(x for x in m['cases'] if x['request']['status'] == 'claimed')
check('homeowner sees 3 notes', len(c['notes']) == 3)
s, _ = call('POST', f'{API}/match/{cid}/notes', angela, {'body': ''})
check('empty note rejected', s == 400)
s, n = call('POST', f'{API}/match/{cid}/notes', angela, {'body': 'Sent the savings statement too', 'document_id': docs['bank_statement']['id']})
check('homeowner note on a document', s == 201 and n['document_id'] == docs['bank_statement']['id'])
s, _ = call('POST', f'{API}/match/{cid}/notes', robert, {'body': 'hi'})
check("another homeowner can't post on Angela's case", s == 404)
s, d = call('GET', f'{API}/leads/summary', maria)
check('Maria now has 3 unread from Angela', next(x for x in d['clients'] if x['contact_name'] == 'Angela Brooks')['unread_notes'] == 3)
s, _ = call('POST', f'{API}/leads/{cid}/notes', david, {'body': 'x'})
check("another pro can't note Maria's case", s == 404)
s, d = call('GET', f'{API}/leads', maria)
rob = next(x for x in d['mine'] if x['contact_name'] == 'Robert Diaz')
s, _ = call('POST', f'{API}/leads/{cid}/notes', maria, {'body': 'x', 'document_id': rob['documents'][0]['id']})
check("can't attach a note to another client's document", s == 404)
s, n = call('POST', f'{API}/leads/{cid}/notes', maria, {'body': 'Friday works. I will call at 10.'})
check('pro replies (marks read)', s == 201)
s, d = call('GET', f'{API}/leads/summary', maria)
check('replying clears Maria unread', next(x for x in d['clients'] if x['contact_name'] == 'Angela Brooks')['unread_notes'] == 0)
s, m = call('GET', f'{API}/match', angela)
c = next(x for x in m['cases'] if x['request']['status'] == 'claimed')
check('Angela has 1 unread from Maria', c['unread_notes'] == 1, c['unread_notes'])
s, _ = call('POST', f'{API}/match/{cid}/notes/read', angela)
s, m = call('GET', f'{API}/match', angela)
c = next(x for x in m['cases'] if x['request']['status'] == 'claimed')
check('Angela marks read', c['unread_notes'] == 0)
s, _ = call('POST', f'{API}/leads/{rob["id"]}/notes/read', maria)
s, d = call('GET', f'{API}/leads/summary', maria)
check('Maria marks Robert read', next(x for x in d['clients'] if x['contact_name'] == 'Robert Diaz')['unread_notes'] == 0)
print(f'\n{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
