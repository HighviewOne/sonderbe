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

import hmac, hashlib, time

# Stripe webhook: signed test events (no Stripe account needed; the backend's STRIPE_WEBHOOK_SECRET
# comes from .env.test.local). checkout.session.completed isn't covered: it calls the Stripe API.
SECRET = env.get('STRIPE_WEBHOOK_SECRET')
if not SECRET:
    sys.exit('STRIPE_WEBHOOK_SECRET missing from .env.test.local')
def webhook(event_type, obj, secret=None):
    # Like Stripe: a 500 (the backend couldn't save it) gets the same event again
    for attempt in range(3):
        status = send_webhook(event_type, obj, secret)
        if status != 500: return status
        time.sleep(2)
    return status
def send_webhook(event_type, obj, secret=None):
    payload = json.dumps({'id': f'evt_test_{time.time_ns()}', 'object': 'event', 'type': event_type, 'data': {'object': obj}}).encode()
    t = int(time.time())
    sig = hmac.new((secret or SECRET).encode(), f'{t}.'.encode() + payload, hashlib.sha256).hexdigest()
    req = urllib.request.Request(f'{API}/stripe/webhook', method='POST', data=payload,
        headers={'Content-Type': 'application/json', 'Stripe-Signature': f't={t},v1={sig}'})
    try:
        with urllib.request.urlopen(req) as r: return r.status
    except urllib.error.HTTPError as e: return e.code
def sub_obj(customer, status):
    now = int(time.time())
    return {'id': f'sub_test_{customer}', 'object': 'subscription', 'customer': customer, 'status': status,
            'current_period_start': now, 'current_period_end': now + 30 * 86400}
def row(user_id):
    return rest('GET', f'investor_subscriptions?select=status,past_due_since,ended_at,current_period_start&user_id=eq.{user_id}')[1][0]
def state(token):
    return call('GET', f'{API}/account/access', token)[1]['state']
def iso(s): return datetime.fromisoformat(s.replace('Z', '+00:00'))
def near(a, b, seconds=120): return abs((a - b).total_seconds()) < seconds

check('bad signature refused', webhook('customer.subscription.updated', sub_obj('cus_demo_negotiator', 'past_due'), secret='whsec_wrong') == 400)
check('unknown customer is ignored', webhook('customer.subscription.updated', sub_obj('cus_nobody', 'active')) == 200)

# Payment fails, recovers, fails again, then Stripe gives up
tony_id = uid('pro.negotiator@example.com'); tony = login('pro.negotiator@example.com')
check('past_due accepted', webhook('customer.subscription.updated', sub_obj('cus_demo_negotiator', 'past_due')) == 200)
r = row(tony_id)
check('past_due: status + start of grace recorded', r['status'] == 'past_due' and r['past_due_since'] and r['ended_at'] is None, r)
check('past_due: grace (full access)', state(tony) == 'grace')
first_due = r['past_due_since']
webhook('customer.subscription.updated', sub_obj('cus_demo_negotiator', 'past_due'))
check('repeat past_due keeps the first date', row(tony_id)['past_due_since'] == first_due)
webhook('customer.subscription.updated', sub_obj('cus_demo_negotiator', 'active'))
r = row(tony_id)
check('payment recovers: active, grace cleared', r['status'] == 'active' and r['past_due_since'] is None and state(tony) == 'active', r)
webhook('customer.subscription.updated', sub_obj('cus_demo_negotiator', 'past_due'))
rest('PATCH', f'investor_subscriptions?user_id=eq.{tony_id}', {'past_due_since': ago(20)})
check('past grace while still past_due: read-only', state(tony) == 'read_only')
webhook('customer.subscription.updated', sub_obj('cus_demo_negotiator', 'unpaid'))
r = row(tony_id)
# Payments failed from 20 days ago, so it ended when the 14-day grace ran out: 6 days ago
check('unpaid ends it at the end of grace (day 14), not today',
      r['status'] == 'canceled' and r['ended_at'] and near(iso(r['ended_at']), iso(ago(6))), r)
check('ended after a failure: read-only, at most 28 days in all', state(tony) == 'read_only')
ended = r['ended_at']
webhook('customer.subscription.deleted', sub_obj('cus_demo_negotiator', 'canceled'))
r = row(tony_id)
check('deleted keeps the first end date', r['status'] == 'canceled' and r['ended_at'] == ended, r)

# Cancel from active (no payment trouble): ends now, 14 days read-only
maria_id = uid('pro.agent@example.com'); maria = login('pro.agent@example.com')
webhook('customer.subscription.updated', sub_obj('cus_demo_agent', 'canceled'))
r = row(maria_id)
check('cancel from active ends today', r['status'] == 'canceled' and near(iso(r['ended_at']), datetime.now(timezone.utc)), r)
check('cancel from active: read-only', state(maria) == 'read_only')

# Never paid: first payment fails and the subscription expires
call('POST', f'{SB}/auth/v1/admin/users', SVC, {'email': 'never.paid@example.com', 'password': 'SonderDemo-2026', 'email_confirm': True}, apikey=SVC)
np_id = uid('never.paid@example.com'); np = login('never.paid@example.com')
rest('POST', 'investor_subscriptions', {'user_id': np_id, 'stripe_customer_id': 'cus_test_neverpaid', 'status': 'inactive'})
rest('PATCH', f'profiles?id=eq.{np_id}', {'role': 'investor'})
webhook('customer.subscription.updated', sub_obj('cus_test_neverpaid', 'incomplete'))
r = row(np_id)
check('incomplete: inactive, no period dates written', r['status'] == 'inactive' and r['current_period_start'] is None, r)
webhook('customer.subscription.updated', sub_obj('cus_test_neverpaid', 'incomplete_expired'))
webhook('customer.subscription.deleted', sub_obj('cus_test_neverpaid', 'incomplete_expired'))
r = row(np_id)
check('never paid: no end date, so no read-only period', r['status'] == 'canceled' and r['ended_at'] is None, r)
check('never paid: no access', state(np) == 'none')

# Renewal after access ended: old cases close before access comes back
leo_id = uid('pro.lapsed@example.com'); leo = login('pro.lapsed@example.com')
rest('PATCH', f'investor_subscriptions?user_id=eq.{leo_id}', {'ended_at': ago(20)})
call('POST', f'{SB}/auth/v1/admin/users', SVC, {'email': 'webhook.case@example.com', 'password': 'SonderDemo-2026', 'email_confirm': True}, apikey=SVC)
wc = uid('webhook.case@example.com')
s, r = rest('POST', 'match_requests', {'homeowner_id': wc, 'category': 'real_estate', 'county': 'San Bernardino', 'situation': 'behind', 'contact_name': 'Webhook Case', 'contact_email': 'webhook.case@example.com', 'consent_text': 'test', 'status': 'claimed', 'claimed_by': leo_id, 'claimed_at': ago(40)})
case_id = r[0]['id']
check('lapsed pro ended before renewing', state(leo) == 'ended')
webhook('customer.subscription.updated', sub_obj('cus_demo_lapsed', 'active'))
r = row(leo_id)
check('renewal: active again, end date cleared', r['status'] == 'active' and r['ended_at'] is None and state(leo) == 'active', r)
s, c = rest('GET', f'match_requests?select=status,closed_reason&id=eq.{case_id}')
check('renewal closed the old case first', c[0]['status'] == 'closed' and c[0]['closed_reason'] == 'professional_inactive', c)

print(f'\n{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
