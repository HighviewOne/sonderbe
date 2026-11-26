#!/bin/sh
# Adds the SonderBe keep-alive lines to the crontab on hamptonserver (each once). Backs up first.
# Copied to hamptonserver:~/sonderbe_keepalive/install-cron.sh; run there.
#   live project: ~/sonderbe_keepalive/config       (added 2026-11-08)
#   test project: ~/sonderbe_keepalive/config-test  (added 2026-11-25; behind the demo site)
set -e
D=/home/highview/sonderbe_keepalive
added=0
crontab -l > "$D/crontab.bak-$(date +%F)"
if ! crontab -l | grep -q 'supabase_keepalive.py >>'; then
  { crontab -l
    echo "# SonderBe Supabase keep-alive (16:15 UTC = 08:15 PST) - source: Dell ~/Projects/sonderbe/ops/supabase_keepalive.py"
    echo "15 16 * * * /usr/bin/python3 $D/supabase_keepalive.py >> $D/keepalive.log 2>&1"
  } | crontab -
  added=$((added + 1))
fi
if ! crontab -l | grep -q 'supabase_keepalive.py config-test'; then
  { crontab -l
    echo "# SonderBe TEST Supabase keep-alive (demo site; 16:20 UTC) - same script, config-test"
    echo "20 16 * * * /usr/bin/python3 $D/supabase_keepalive.py config-test >> $D/keepalive.log 2>&1"
  } | crontab -
  added=$((added + 1))
fi
echo "added $added line(s); scheduled jobs now: $(crontab -l | grep -cE '^[0-9*]')"
