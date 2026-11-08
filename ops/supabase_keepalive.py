#!/usr/bin/env python3
"""Keep the free-tier Supabase project from pausing for inactivity.

Supabase pauses free projects after about a week with no database activity (that is
what took SonderBe down in 2026). Once a day this runs a tiny REST query that reaches
Postgres. It uses the PUBLIC anon key (already shipped in the frontend bundle), never
the service-role key. It reads distressed_properties, whose RLS has no policies, so it
gets an empty list without touching the (self-recursive) profiles policies; the query
still counts as activity.

Runs from cron on hamptonserver as ~/sonderbe_keepalive/supabase_keepalive.py.
Config: ~/sonderbe_keepalive/config with SUPABASE_URL=... and SUPABASE_ANON_KEY=...
Alerts: emails EMAIL_TO from ~/.nod_email after 2 failed runs in a row, and once on
recovery. Silent otherwise.

Source: Dell ~/Projects/sonderbe/ops/supabase_keepalive.py
"""
import json, smtplib, ssl, sys, urllib.error, urllib.request
from datetime import datetime, timezone
from email.mime.text import MIMEText
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE = HERE / "state.json"
FAILS_BEFORE_ALERT = 2


def read_kv(path):
    out = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def ping(url, key):
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/distressed_properties?select=id&limit=1",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            if r.status == 200 and body.lstrip().startswith("["):
                return True, f"HTTP 200 {body[:40]}"
            return False, f"HTTP {r.status} {body[:200]}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} {e.read().decode(errors='replace')[:200]}"
    except Exception as e:  # DNS failure, timeout, connection refused...
        return False, f"{type(e).__name__}: {e}"


def email(subject, body):
    cfg = read_kv(Path.home() / ".nod_email")
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = cfg.get("EMAIL_FROM", cfg["SMTP_USER"])
    msg["To"] = cfg["EMAIL_TO"]
    with smtplib.SMTP(cfg["SMTP_HOST"], int(cfg.get("SMTP_PORT", 587)), timeout=30) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(cfg["SMTP_USER"], cfg["SMTP_PASS"])
        s.sendmail(msg["From"], [cfg["EMAIL_TO"]], msg.as_string())


def main():
    cfg = read_kv(HERE / "config")
    state = json.loads(STATE.read_text()) if STATE.exists() else {"fails": 0, "alerted": False}
    ok, detail = ping(cfg["SUPABASE_URL"], cfg["SUPABASE_ANON_KEY"])
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"{now} {'ok' if ok else 'FAIL'} {detail}")

    if ok:
        if state["alerted"]:
            email("SonderBe Supabase is answering again",
                  f"The keep-alive ping succeeded at {now} after {state['fails']} failed run(s).\n")
        state = {"fails": 0, "alerted": False, "last_ok": now}
    else:
        state["fails"] += 1
        if state["fails"] >= FAILS_BEFORE_ALERT and not state["alerted"]:
            email("SonderBe Supabase keep-alive failing",
                  f"The daily ping to {cfg['SUPABASE_URL']} has failed {state['fails']} runs in a row.\n"
                  f"Latest: {detail}\nLast success: {state.get('last_ok', 'unknown')}\n\n"
                  "If the project is paused, resume it at https://supabase.com/dashboard "
                  "(it takes a few minutes to answer afterwards).\n"
                  "Log: hamptonserver:~/sonderbe_keepalive/keepalive.log\n")
            state["alerted"] = True
    STATE.write_text(json.dumps(state))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
