#!/bin/sh
# Adds the SonderBe keep-alive line to the crontab on hamptonserver (once). Backs up first.
# Copied to hamptonserver:~/sonderbe_keepalive/install-cron.sh; run there.
set -e
if crontab -l | grep -q sonderbe_keepalive.py; then echo "already installed"; exit 0; fi
crontab -l > ~/sonderbe_keepalive/crontab.bak-2026-11-08
{ crontab -l
  echo "# SonderBe Supabase keep-alive (16:15 UTC = 08:15 PST) - source: Dell ~/Projects/sonderbe/ops/supabase_keepalive.py"
  echo "15 16 * * * /usr/bin/python3 /home/highview/sonderbe_keepalive/supabase_keepalive.py >> /home/highview/sonderbe_keepalive/keepalive.log 2>&1"
} | crontab -
echo "installed; scheduled jobs now: $(crontab -l | grep -cE '^[0-9*]')"
