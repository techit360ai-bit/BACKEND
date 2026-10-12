#!/usr/bin/env bash
# =============================================================================
# Raise RDS max_connections for the platform instance (techit-postgres).
#
# RUN THIS WITH THE INFRA AWS ACCOUNT — the account that owns RDS. The box's
# instance role and the local developer credentials are a DIFFERENT account and
# return an empty result for this instance (this is why the value is changed
# here rather than from CI).
#
#   bash ops/ec2/rds-raise-max-connections.sh --region eu-west-1 --instance techit-postgres --value 200          # dry run
#   bash ops/ec2/rds-raise-max-connections.sh --region eu-west-1 --instance techit-postgres --value 200 --apply   # change it
#
# Facts that make this safe:
#   * max_connections lives in a DB PARAMETER GROUP. RDS `default.*` groups are
#     read-only, so a custom group is created and associated when needed.
#   * max_connections is a STATIC parameter: the change applies after a reboot.
#   * Since the platform now shares one pg.Pool behind PgBouncer (transaction
#     pooling), RDS only ever sees ~default_pool_size server connections, so the
#     stock 81 is normally sufficient. Raise this only if `pg_stat_activity`
#     still shows the ceiling being hit.
# =============================================================================
set -euo pipefail

REGION="eu-west-1"
INSTANCE="techit-postgres"
VALUE=""
APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --region) REGION="${2:-}"; shift 2 ;;
    --instance) INSTANCE="${2:-}"; shift 2 ;;
    --value) VALUE="${2:-}"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    *) shift ;;
  esac
done
if [ -z "$VALUE" ]; then
  echo "usage: $0 --region eu-west-1 --instance techit-postgres --value 200 [--apply]" >&2
  exit 2
fi

command -v aws >/dev/null 2>&1 || { echo "aws cli not found" >&2; exit 1; }

echo "== instance =="
aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$INSTANCE" \
  --query 'DBInstances[0].{class:DBInstanceClass,engine:Engine,pg:DBParameterGroups[0].DBParameterGroupName,status:DBInstanceStatus}' \
  --output json

CURRENT_PG="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$INSTANCE" \
  --query 'DBInstances[0].DBParameterGroups[0].DBParameterGroupName' --output text)"

FAMILY="$(aws rds describe-db-parameter-groups --region "$REGION" --db-parameter-group-name "$CURRENT_PG" \
  --query 'DBParameterGroups[0].DBParameterGroupFamily' --output text)"

TARGET_PG="$CURRENT_PG"
NEW_PG=0
case "$CURRENT_PG" in
  default.*) TARGET_PG="techit-postgres-custom"; NEW_PG=1 ;;
esac
echo "current parameter group: $CURRENT_PG (family $FAMILY)"
echo "target  parameter group: $TARGET_PG"

if [ "$APPLY" != "1" ]; then
  echo
  echo "DRY RUN — would run:"
  [ "$NEW_PG" = "1" ] && echo "  aws rds create-db-parameter-group --db-parameter-group-name $TARGET_PG --db-parameter-group-family $FAMILY --description 'TechIT platform tuning'"
  echo "  aws rds modify-db-parameter-group --db-parameter-group-name $TARGET_PG --parameters 'ParameterName=max_connections,ParameterValue=$VALUE,ApplyMethod=pending-reboot'"
  [ "$NEW_PG" = "1" ] && echo "  aws rds modify-db-instance --db-instance-identifier $INSTANCE --db-parameter-group-name $TARGET_PG --apply-immediately"
  echo "  aws rds reboot-db-instance --db-instance-identifier $INSTANCE"
  echo "(pass --apply to execute)"
  exit 0
fi

if [ "$NEW_PG" = "1" ]; then
  aws rds create-db-parameter-group --region "$REGION" \
    --db-parameter-group-name "$TARGET_PG" --db-parameter-group-family "$FAMILY" \
    --description "TechIT platform tuning (max_connections)" >/dev/null
fi

aws rds modify-db-parameter-group --region "$REGION" --db-parameter-group-name "$TARGET_PG" \
  --parameters "ParameterName=max_connections,ParameterValue=$VALUE,ApplyMethod=pending-reboot" >/dev/null

if [ "$NEW_PG" = "1" ]; then
  aws rds modify-db-instance --region "$REGION" --db-instance-identifier "$INSTANCE" \
    --db-parameter-group-name "$TARGET_PG" --apply-immediately >/dev/null
fi

echo "✅ max_connections=$VALUE staged on $TARGET_PG. Rebooting to apply (static parameter)..."
aws rds reboot-db-instance --region "$REGION" --db-instance-identifier "$INSTANCE" >/dev/null
echo "✅ reboot requested. Verify with:"
echo "  SELECT setting FROM pg_settings WHERE name='max_connections';"
