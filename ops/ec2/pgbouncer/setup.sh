#!/usr/bin/env bash
# =============================================================================
# Provision PgBouncer (transaction pooling) in front of the platform RDS.
#
#   sudo bash ops/ec2/pgbouncer/setup.sh [--rds-url postgres://user:pass@host:5432/db]
#
# Idempotent: safe to run on every deploy. Defaults the RDS URL to
# $HOME/.techit/platform-database-url (the DevOps-owned on-box credential).
# Only 127.0.0.1:6432 is exposed; the credential file is owner-only 0600.
# =============================================================================
set -euo pipefail

RDS_URL=""
CRED_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --rds-url) RDS_URL="${2:-}"; shift 2 ;;
    --credential-file) CRED_FILE="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done
# Resolve the credential without ever putting the password in argv (visible to
# `ps`): prefer an explicit file, then the env, then the known on-box path
# (which differs from $HOME when this script is run under sudo).
for candidate in "$CRED_FILE" "${PLATFORM_RDS_URL_FILE:-}" "$HOME/.techit/platform-database-url" /home/ubuntu/.techit/platform-database-url; do
  if [ -n "$RDS_URL" ]; then
    break
  fi
  if [ -n "$candidate" ] && [ -s "$candidate" ]; then
    RDS_URL="$(cat "$candidate")"
  fi
done
if [ -z "$RDS_URL" ] && [ -n "${PLATFORM_RDS_URL:-}" ]; then
  RDS_URL="$PLATFORM_RDS_URL"
fi
if [ -z "$RDS_URL" ]; then
  echo "pgbouncer: no RDS url (pass --rds-url or provide $HOME/.techit/platform-database-url)" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/pgbouncer.ini.template"
[ -f "$TEMPLATE" ] || { echo "pgbouncer: template not found at $TEMPLATE" >&2; exit 1; }

if ! command -v pgbouncer >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -y -o Acquire::Retries=3 >/dev/null 2>&1 || true
  sudo apt-get install -y --no-install-recommends pgbouncer >/dev/null 2>&1 || true
fi
if ! command -v pgbouncer >/dev/null 2>&1; then
  echo "pgbouncer: install failed (apt could not fetch the package)" >&2
  exit 1
fi

# Render config from the canonical URL. Node parses the URL so a password with
# shell metacharacters can never corrupt the rendered files.
TMP_INI="$(mktemp)"; TMP_USERLIST="$(mktemp)"
trap 'rm -f "$TMP_INI" "$TMP_USERLIST"' EXIT
RDS_URL="$RDS_URL" TEMPLATE="$TEMPLATE" OUT_INI="$TMP_INI" OUT_LIST="$TMP_USERLIST" node -e '
  const fs = require("fs");
  const u = new URL(process.env.RDS_URL);
  const host = u.hostname || "127.0.0.1";
  const port = u.port || "5432";
  const user = decodeURIComponent(u.username || "");
  const password = decodeURIComponent(u.password || "");
  if (!user) { console.error("pgbouncer: RDS url has no user"); process.exit(1); }
  const ini = fs.readFileSync(process.env.TEMPLATE, "utf8")
    .replaceAll("{{DB_HOST}}", host)
    .replaceAll("{{DB_PORT}}", port)
    .replaceAll("{{DB_USER}}", user);
  fs.writeFileSync(process.env.OUT_INI, ini);
  fs.writeFileSync(process.env.OUT_LIST, `"${user}" "${password}"\n`);
'

# Restarting PgBouncer drops every live connection for a moment. A deploy that
# did not change the config must not do that (it raced an ai-router deploy whose
# fresh connection was refused mid-restart), so only restart when the rendered
# config actually differs or the service is not running.
CHANGED=1
if sudo test -f /etc/pgbouncer/pgbouncer.ini && sudo test -f /etc/pgbouncer/userlist.txt \
   && sudo cmp -s "$TMP_INI" /etc/pgbouncer/pgbouncer.ini \
   && sudo cmp -s "$TMP_USERLIST" /etc/pgbouncer/userlist.txt; then
  CHANGED=0
fi

sudo install -d -m 0755 /etc/pgbouncer
sudo install -m 0640 "$TMP_INI" /etc/pgbouncer/pgbouncer.ini
sudo install -m 0640 "$TMP_USERLIST" /etc/pgbouncer/userlist.txt

# The Debian/RHEL service runs as a dedicated user; make the credential readable
# only by that user (fall back to root when the unit does not declare one).
PGB_USER="$(systemctl show -p User --value pgbouncer 2>/dev/null || true)"
[ -z "$PGB_USER" ] && PGB_USER="postgres"
if id "$PGB_USER" >/dev/null 2>&1; then
  sudo chown "$PGB_USER" /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt /etc/pgbouncer
else
  sudo chown root /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt
fi

sudo systemctl enable pgbouncer >/dev/null 2>&1 || true
if [ "$CHANGED" = "0" ] && systemctl is-active --quiet pgbouncer; then
  echo "pgbouncer: config unchanged and service already active; not restarting"
else
  sudo systemctl restart pgbouncer
fi

# Readiness: a bare TCP accept on the loopback port is enough to know PgBouncer
# is listening (no psql needed on a box that only talks to RDS).
for _ in $(seq 1 20); do
  if node -e 'const n=require("net");const s=n.connect(6432,"127.0.0.1");s.on("connect",()=>{s.end();process.exit(0)});s.on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),2000)'; then
    echo "pgbouncer ready on 127.0.0.1:6432 (pool_mode=transaction, default_pool_size=30)"
    exit 0
  fi
  sleep 1
done
echo "pgbouncer did not become ready; last log lines:" >&2
sudo journalctl -u pgbouncer -n 40 --no-pager >&2 || true
sudo cat /etc/pgbouncer/pgbouncer.ini >&2 || true
exit 1
