import json, os, sys, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
# Runs against the TEST Supabase project + a local backend started with `npm run dev:test`.
# Usage: python3 -I tests/api/<file> [path/to/.env.test.local]   (or: npm run test:api)
ENV_FILE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', '.env.test.local')
env = dict(l.strip().split('=', 1) for l in open(ENV_FILE) if '=' in l and not l.startswith('#'))
if 'gfeeiyjhjapysiqxwiqi' in env['SUPABASE_URL']:
    sys.exit('Refusing to run API tests against the LIVE project')
SB, ANON, SVC = env['SUPABASE_URL'], env['SUPABASE_ANON_KEY'], env['SUPABASE_SERVICE_ROLE_KEY']
API = os.environ.get('API_URL', 'http://localhost:3001/api')
ok = fail = 0
def call(method, url, token=None, body=None, apikey=None, extra=None):
    h = {'Content-Type': 'application/json'}
    if token: h['Authorization'] = 'Bearer ' + token
    if apikey: h['apikey'] = apikey
    if extra: h.update(extra)
    req = urllib.request.Request(url, method=method, headers=h, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        t = e.read()
        try: return e.code, json.loads(t or 'null')
        except ValueError: return e.code, {'error': t.decode(errors='replace')[:200]}
def rest(method, path, body=None):
    return call(method, f'{SB}/rest/v1/{path}', SVC, body, apikey=SVC, extra={'Prefer': 'return=representation'})
def login(email):
    return call('POST', f'{SB}/auth/v1/token?grant_type=password', body={'email': email, 'password': 'SonderDemo-2026'}, apikey=ANON)[1]['access_token']
def check(name, cond, extra=''):
    global ok, fail
    if cond: ok += 1; print('PASS', name)
    else: fail += 1; print('FAIL', name, extra)
def uid(email):
    return rest('GET', f'profiles?select=id&email=eq.{email}')[1][0]['id']
ago = lambda d: (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()

grace, lapsed, stranded, home, admin, maria, priya = [login(e) for e in ['pro.grace@example.com','pro.lapsed@example.com','home.stranded@example.com','home.new@example.com','admin@example.com','pro.agent@example.com','pro.harbor@example.com']]

# Grace
s, a = call('GET', f'{API}/account/access', grace)
check('grace state with an end date', s == 200 and a['state'] == 'grace' and a['until'] and a['via'] == 'own', a)
check('demo mode on in test env', a.get('demo_mode') is True)
s, _ = call('PUT', f'{API}/leads/info', grace, {'full_name': 'Gina Torres', 'phone': '(805) 555-0131'})
check('grace: can still make changes', s == 200)
s, d = call('GET', f'{API}/directory?county=Ventura', home)
check('grace: still listed', any(p['full_name'] == 'Gina Torres' for p in d['professionals']))

# Read-only
s, a = call('GET', f'{API}/account/access', lapsed)
check('read-only state', a['state'] == 'read_only' and a['until'])
s, d = call('GET', f'{API}/leads', lapsed)
check('read-only: can read clients', s == 200 and any(c['contact_name'] == 'Sam Rivera' for c in d['mine']))
sam_case = next(c for c in d['mine'] if c['contact_name'] == 'Sam Rivera')
s, d = call('POST', f'{API}/leads/{sam_case["id"]}/stage', lapsed, {'stage': 'first_contact'})
check('read-only: changes blocked with code', s == 402 and d.get('code') == 'read_only', (s, d))
s, d = call('GET', f'{API}/directory?county=San%20Bernardino', home)
check('read-only: hidden from directory', not any(p['full_name'] == 'Leo Park' for p in d['professionals']))
s, m = call('GET', f'{API}/match', stranded)
c = m['cases'][0]
check('homeowner sees professional inactive (case still open)', c['request']['status'] == 'claimed' and c['professional_status'] == 'inactive', c.get('professional_status'))
s, d = call('GET', f'{API}/directory?county=Los%20Angeles', stranded)
mid = next(p['id'] for p in d['professionals'] if p['full_name'] == 'Maria Lopez')
s, d = call('POST', f'{API}/match', stranded, {'professional_id': mid, 'county': 'Los Angeles', 'situation': 'behind', 'contact_name': 'Sam Rivera', 'consent': True})
check('homeowner can choose someone new without withdrawing', s == 200, (s, d))
s, m = call('GET', f'{API}/match', stranded)
c = m['cases'][0]
check('new case with Maria, active', c['professional']['full_name'] == 'Maria Lopez' and c['professional_status'] == 'active')
check('document list carried over, reset', len(c['documents']) == 2 and all(x['sent_at'] is None and x['received_at'] is None and x['round'] == 1 for x in c['documents']), c['documents'])
check('old timeline replaced', len(c['events']) == 1 and 'Maria' in c['events'][0]['note'])
s, d = call('GET', f'{API}/leads', lapsed)
check('old professional no longer has the case', not any(x['id'] == sam_case['id'] and x['status'] == 'claimed' for x in d['mine']))

# Ended: case closes automatically
leo = uid('pro.lapsed@example.com'); hn = uid('home.new@example.com')
rest('PATCH', f'investor_subscriptions?user_id=eq.{leo}', {'ended_at': ago(20)})
s, r = rest('POST', 'match_requests', {'homeowner_id': hn, 'category': 'real_estate', 'county': 'Los Angeles', 'situation': 'behind', 'contact_name': 'Linda Park', 'contact_email': 'home.new@example.com', 'consent_text': 'test', 'status': 'claimed', 'claimed_by': leo, 'claimed_at': ago(30)})
s, a = call('GET', f'{API}/account/access', lapsed)
check('after read-only period: ended', a['state'] == 'ended')
s, d = call('GET', f'{API}/leads', lapsed)
check('ended: no portal access', s == 403 and d.get('code') == 'subscription_required')
s, m = call('GET', f'{API}/match', home)
c = m['cases'][0]
check('ended: homeowner case closed with reason', c['request']['status'] == 'closed' and c['request']['closed_reason'] == 'professional_inactive' , c['request'])

# Brokerage agent follows broker
david = uid('pro.broker@example.com')
rest('PATCH', f'investor_subscriptions?user_id=eq.{david}', {'status': 'canceled', 'ended_at': ago(2)})
s, a = call('GET', f'{API}/account/access', priya)
check('agent follows broker into read-only', a['state'] == 'read_only' and a['via'] == 'brokerage' and a['brokerage_name'] == 'Harbor Brokerage Group', a)
rest('PATCH', f'investor_subscriptions?user_id=eq.{david}', {'status': 'active', 'ended_at': None})
s, a = call('GET', f'{API}/account/access', priya)
check('agent back to active when broker pays', a['state'] == 'active')

# Demo payment bypass
s, u = call('POST', f'{SB}/auth/v1/admin/users', SVC, {'email': 'demo.signup@example.com', 'password': 'SonderDemo-2026', 'email_confirm': True}, apikey=SVC)
ds = login('demo.signup@example.com')
s, a = call('GET', f'{API}/account/access', ds)
check('new account starts with no subscription', a['state'] == 'none')
s, _ = call('POST', f'{API}/account/demo-subscription', ds)
check('skip payment works in test env', s == 200)
s, _ = call('GET', f'{API}/leads', ds)
check('skipped account reaches the pro portal', s == 200)
s, _ = call('POST', f'{API}/account/demo-subscription', admin)
check('admin cannot use demo subscription', s == 400)

# Admin ads
s, d = call('GET', f'{API}/admin/ads', admin)
check('admin lists ads', s == 200 and len(d['ads']) == 5)
s, _ = call('GET', f'{API}/admin/ads', maria)
check('non-admin blocked', s == 403)
s, _ = call('DELETE', f'{API}/admin/ads/not-a-uuid', admin)
check('bad ad id is "not found", not a server error', s == 404, s)
s, _ = call('POST', f'{API}/admin/ads/not-a-uuid/report-link', admin)
check('bad ad id on report link is "not found"', s == 404, s)
s, d = call('POST', f'{API}/admin/ads', admin, {'business_name': 'Long Site Movers', 'category': 'storage', 'headline': 'Storage near you',
                                               'website': 'https://example.com/' + 'a' * 300})
check('too-long website is rejected, not cut off', s == 400 and 'website' in d.get('error', ''), d)
base = {'business_name': 'Test Movers', 'category': 'movers', 'headline': 'Fast local moves', 'counties': ['Orange'], 'active': True}
s, d = call('POST', f'{API}/admin/ads', admin, base)
check('mover without Cal-T cannot go live', s == 400 and 'Cal-T' in d['error'])
s, d = call('POST', f'{API}/admin/ads', admin, {**base, 'category': 'other', 'headline': 'We buy houses for cash!'})
check('cash buyer ad refused', s == 400)
s, d = call('POST', f'{API}/admin/ads', admin, {**base, 'category': 'other', 'headline': 'Low rate refinance loans'})
check('loan ad refused', s == 400)
s, d = call('POST', f'{API}/admin/ads', admin, {**base, 'starts_on': '2026-12-01', 'ends_on': '2026-11-01', 'license_number': 'DEMO-1'})
check('end before start refused', s == 400)
s, ad = call('POST', f'{API}/admin/ads', admin, {**base, 'license_number': 'DEMO-123', 'monthly_price': '120', 'contact_email': 'x@example.com'})
check('valid mover ad created with Cal-T label + report link', s == 201 and ad['license_label'] == 'Cal-T' and ad['report_token'], (s, ad))
s, d = call('GET', f'{API}/services?county=Orange', home)
check('new ad shows to Orange homeowners', any(a['business_name'] == 'Test Movers' for a in d['ads']))
s, r = call('GET', f'{API}/services/report/{ad["report_token"]}')
check('public report works without login', s == 200 and r['business_name'] == 'Test Movers' and r['view_count'] >= 1 and 'contact_email' not in r, r)
s, _ = call('GET', f'{API}/services/report/' + 'x' * 30)
check('bad report token 404', s == 404)
s, d = call('PUT', f'{API}/admin/ads/{ad["id"]}', admin, {**base, 'license_number': 'DEMO-123', 'active': False})
check('ad turned off', s == 200 and d['active'] is False)
s, d = call('GET', f'{API}/services?county=Orange', home)
check('off ad hidden', not any(a['business_name'] == 'Test Movers' for a in d['ads']))
s, _ = call('DELETE', f'{API}/admin/ads/{ad["id"]}', admin)
check('ad deleted', s == 200)
# Legacy open pool: attorneys can't claim, and only same-category professionals can
def new_homeowner(email):
    call('POST', f'{SB}/auth/v1/admin/users', SVC, {'email': email, 'password': 'SonderDemo-2026', 'email_confirm': True}, apikey=SVC)
    return uid(email)
attorney, legal = login('pro.attorney@example.com'), login('pro.legal@example.com')
ct = new_homeowner('claim.test@example.com')
s, r = rest('POST', 'match_requests', {'homeowner_id': ct, 'category': 'real_estate', 'county': 'Los Angeles', 'situation': 'behind', 'contact_name': 'Claim Test', 'contact_email': 'claim.test@example.com', 'consent_text': 'test', 'status': 'open'})
open_id = r[0]['id']
s, d = call('GET', f'{API}/leads', attorney)
check('attorney does not see open requests', s == 200 and not any(x['id'] == open_id for x in d['open']), d.get('open'))
s, d = call('POST', f'{API}/leads/{open_id}/claim', attorney)
check('attorney cannot claim an open request', s == 403, (s, d))
s, d = call('GET', f'{API}/leads', legal)
check('legal professional does not see real estate requests', s == 200 and not any(x['id'] == open_id for x in d['open']))
s, d = call('POST', f'{API}/leads/{open_id}/claim', legal)
check('legal professional cannot claim a real estate request', s == 409, (s, d))
s, d = call('GET', f'{API}/leads', maria)
check('agent sees the open request', any(x['id'] == open_id for x in d['open']))
s, d = call('POST', f'{API}/leads/{open_id}/claim', maria)
check('agent can claim it', s == 200 and d['status'] == 'claimed', (s, d))

# Ended professional renews without the homeowner visiting: the old case stays closed
rt = new_homeowner('renew.test@example.com')
s, r = rest('POST', 'match_requests', {'homeowner_id': rt, 'category': 'real_estate', 'county': 'San Bernardino', 'situation': 'behind', 'contact_name': 'Renew Test', 'contact_email': 'renew.test@example.com', 'consent_text': 'test', 'status': 'claimed', 'claimed_by': leo, 'claimed_at': ago(40)})
renew_case = r[0]['id']
s, a = call('GET', f'{API}/account/access', lapsed)
check('lapsed pro still ended before renewing', a['state'] == 'ended')
s, _ = call('POST', f'{API}/account/demo-subscription', lapsed)
check('ended pro renews', s == 200)
s, d = call('GET', f'{API}/leads', lapsed)
check('renewed pro does not get the old case back', s == 200 and not any(x['id'] == renew_case and x['status'] == 'claimed' for x in d['mine']), (s, [x['status'] for x in d.get('mine', [])]))
s, r = rest('GET', f'match_requests?select=status,closed_reason&id=eq.{renew_case}')
check('old case closed as professional_inactive', r[0]['status'] == 'closed' and r[0]['closed_reason'] == 'professional_inactive', r)

# Type lock: same-category changes are fine with active clients, switching category is not
s, p = call('GET', f'{API}/leads/profile', maria)
body = {'business_name': p['business_name'], 'bio': p['bio'], 'website': p['website'], 'license_number': p['license_number'], 'pledge': bool(p['no_upfront_fee_pledged_at']), 'listed': p['listed']}
s, d = call('PUT', f'{API}/leads/profile', maria, {**body, 'professional_type': 'broker'})
check('agent with clients can become a broker', s == 200 and d['professional_type'] == 'broker', (s, d))
s, d = call('PUT', f'{API}/leads/profile', maria, {**body, 'professional_type': 'attorney'})
check('agent with clients cannot switch to legal', s == 409 and d.get('code') == 'type_locked', (s, d))
s, d = call('PUT', f'{API}/leads/profile', maria, {**body, 'professional_type': 'agent'})
check('broker back to agent', s == 200 and d['professional_type'] == 'agent')

# License verification (admin)
maria_id = uid('pro.agent@example.com'); tony_id = uid('pro.negotiator@example.com')
rest('PATCH', f'profiles?id=eq.{maria_id}', {'license_verified': False})
s, _ = call('GET', f'{API}/admin/licenses', maria)
check('licenses: admin only', s == 403)
s, d = call('GET', f'{API}/admin/licenses?status=pending', admin)
mrow = next((p for p in d.get('professionals', []) if p['id'] == maria_id), None)
check('licenses: unverified number is listed to check', s == 200 and mrow is not None, (s, d))
check('licenses: unlicensed types are not listed', not any(p['id'] == tony_id for p in d['professionals']))
s, d = call('GET', f'{API}/admin/licenses?status=bogus', admin)
check('licenses: unknown filter refused', s == 400)
s, d = call('PATCH', f'{API}/admin/licenses/{maria_id}', admin, {'verified': True, 'license_number': 'DEMO-WRONG'})
check('licenses: verifying a number that is no longer on file is refused', s == 409 and d.get('code') == 'license_changed', (s, d))
s, d = call('PATCH', f'{API}/admin/licenses/{maria_id}', admin, {'verified': True, 'license_number': mrow['license_number']})
check('licenses: admin marks verified', s == 200 and d['license_verified'] is True, (s, d))
check('licenses: records who verified and when', d.get('license_verified_at') and d.get('verified_by_name') == 'Demo Admin', d)
s, h = call('GET', f'{API}/admin/licenses/{maria_id}/history', admin)
check('licenses: history logs the check with the number and admin',
      s == 200 and h['checks'][0]['action'] == 'verified' and h['checks'][0]['admin_name'] == 'Demo Admin'
      and h['checks'][0]['license_number'] == mrow['license_number'], (s, h))
s, _ = call('GET', f'{API}/admin/licenses/{maria_id}/history', maria)
check('licenses: history is admin only', s == 403)
s, d = call('PATCH', f'{API}/admin/licenses/{maria_id}', admin, {'verified': False, 'license_number': mrow['license_number']})
check('licenses: removing verification clears who and when', s == 200 and d['license_verified'] is False
      and d['license_verified_at'] is None and d['verified_by_name'] is None, (s, d))
s, h = call('GET', f'{API}/admin/licenses/{maria_id}/history', admin)
check('licenses: history keeps the removal and the earlier check', [c['action'] for c in h['checks'][:2]] == ['removed', 'verified'], h)
s, d = call('PATCH', f'{API}/admin/licenses/{maria_id}', admin, {'verified': True, 'license_number': mrow['license_number']})
check('licenses: verified again', s == 200 and d['license_verified'] is True, (s, d))
s, d = call('GET', f'{API}/directory?county=Los%20Angeles', home)
check('licenses: directory shows verified', any(p['id'] == maria_id and p['license_verified'] for p in d['professionals']))
s, d = call('GET', f'{API}/admin/licenses?status=verified', admin)
check('licenses: now under verified', any(p['id'] == maria_id for p in d['professionals']))
s, d = call('PATCH', f'{API}/admin/licenses/{tony_id}', admin, {'verified': True, 'license_number': 'X'})
check('licenses: unlicensed professional cannot be verified', s == 404)
s, d = call('PATCH', f'{API}/admin/licenses/{maria_id}', admin, {'verified': 'yes'})
check('licenses: bad body refused', s == 400)
s, p = call('GET', f'{API}/leads/profile', maria)
body = {'business_name': p['business_name'], 'bio': p['bio'], 'website': p['website'], 'pledge': True, 'listed': p['listed'], 'professional_type': p['professional_type']}
s, d = call('PUT', f'{API}/leads/profile', maria, {**body, 'license_number': 'DEMO-DRE-09999999'})
check('licenses: changing the number clears verification', s == 200 and d['license_verified'] is False, (s, d))
s, r = rest('GET', f'profiles?select=license_verified_at,license_verified_by&id=eq.{maria_id}')
check('licenses: number change clears who and when', r[0]['license_verified_at'] is None and r[0]['license_verified_by'] is None, r)
s, h = call('GET', f'{API}/admin/licenses/{maria_id}/history', admin)
check('licenses: history logs the clear with the old number and no admin',
      h['checks'][0]['action'] == 'cleared' and h['checks'][0]['license_number'] == mrow['license_number']
      and h['checks'][0]['admin_name'] is None, h)
s, d = call('PATCH', f'{API}/admin/licenses/{maria_id}', admin, {'verified': True, 'license_number': mrow['license_number']})
check('licenses: old number can no longer be verified', s == 409)

# Photos: replacing or removing one deletes the old public file
def upload_avatar(token):
    boundary = 'sonderbetestboundary'
    png = b'\x89PNG\r\n\x1a\n' + b'0' * 32
    data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n').encode() + png + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(f'{API}/leads/avatar', method='POST', data=data,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': f'multipart/form-data; boundary={boundary}'})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())['avatar_url']
def public_status(url):
    # Ask storage directly: the public URL is CDN-cached, so it can still answer after a delete
    url = url.replace('/object/public/', '/object/authenticated/')
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + SVC, 'apikey': SVC})
    try:
        with urllib.request.urlopen(req) as r: return r.status
    except urllib.error.HTTPError as e: return e.code
first = upload_avatar(maria)
check('photo uploaded and public', public_status(first) == 200)
second = upload_avatar(maria)
check('replacing a photo deletes the old file', public_status(first) in (400, 404) and public_status(second) == 200)
s, _ = call('DELETE', f'{API}/leads/avatar', maria)
check('removing a photo deletes the file', s == 200 and public_status(second) in (400, 404))

print(f'\n{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
