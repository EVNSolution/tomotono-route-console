#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?Set AWS_REGION}"
: "${TOMOTONO_SSM_TARGET_KEY:=tag:Service}"
: "${TOMOTONO_SSM_TARGET_VALUE:=tomotono-route-console}"
: "${TOMOTONO_DEPLOY_BRANCH:=main}"
: "${TOMOTONO_DEPLOY_DIR:=/opt/tomotono-route-console}"
: "${TOMOTONO_REPO_URL:=https://github.com/EVNSolution/tomotono-route-console.git}"
: "${TOMOTONO_WAIT_FOR_COMPLETION:=true}"
: "${TOMOTONO_COMMAND_TIMEOUT_SECONDS:=1200}"
export AWS_REGION TOMOTONO_SSM_TARGET_KEY TOMOTONO_SSM_TARGET_VALUE
export TOMOTONO_DEPLOY_BRANCH TOMOTONO_DEPLOY_DIR TOMOTONO_REPO_URL
export TOMOTONO_WAIT_FOR_COMPLETION TOMOTONO_COMMAND_TIMEOUT_SECONDS

COMMANDS_JSON="$(python3 - <<'PY'
import json
import os

exports = {
    "TOMOTONO_REPO_URL": os.environ["TOMOTONO_REPO_URL"],
    "TOMOTONO_DEPLOY_BRANCH": os.environ["TOMOTONO_DEPLOY_BRANCH"],
    "TOMOTONO_DEPLOY_DIR": os.environ["TOMOTONO_DEPLOY_DIR"],
    "APP_TIMEZONE": os.environ.get("APP_TIMEZONE", "America/Toronto"),
    "AWS_REGION": os.environ["AWS_REGION"],
    "ADMIN_PASSWORD": os.environ.get("TOMOTONO_ADMIN_PASSWORD", ""),
    "ADMIN_SESSION_TOKEN": os.environ.get("TOMOTONO_ADMIN_SESSION_TOKEN", ""),
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": os.environ.get("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", ""),
    "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID": os.environ.get("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", ""),
    "GOOGLE_MAPS_SERVER_API_KEY": os.environ.get("GOOGLE_MAPS_SERVER_API_KEY", ""),
}
commands = [
    "set -euo pipefail",
    *[f"export {key}={json.dumps(value)}" for key, value in exports.items() if value],
    "if ! command -v curl >/dev/null 2>&1; then if command -v dnf >/dev/null 2>&1; then dnf install -y curl; elif command -v yum >/dev/null 2>&1; then yum install -y curl; elif command -v apt-get >/dev/null 2>&1; then apt-get update -y && apt-get install -y curl; else echo 'curl is required to download the deploy script' >&2; exit 1; fi; fi",
    "mkdir -p /tmp/tomotono-route-console-deploy",
    "cd /tmp/tomotono-route-console-deploy",
    f"curl -fsSL --retry 3 https://raw.githubusercontent.com/EVNSolution/tomotono-route-console/{os.environ['TOMOTONO_DEPLOY_BRANCH']}/scripts/ec2-bootstrap-and-deploy.sh -o deploy.sh",
    "chmod +x deploy.sh",
    "./deploy.sh",
]
print(json.dumps({"commands": commands, "executionTimeout": [os.environ["TOMOTONO_COMMAND_TIMEOUT_SECONDS"]]}))
PY
)"

COMMAND_ID="$(aws ssm send-command \
  --region "${AWS_REGION}" \
  --document-name "AWS-RunShellScript" \
  --targets "Key=${TOMOTONO_SSM_TARGET_KEY},Values=${TOMOTONO_SSM_TARGET_VALUE}" \
  --comment "Deploy tomotono-route-console ${TOMOTONO_DEPLOY_BRANCH}" \
  --parameters "${COMMANDS_JSON}" \
  --query 'Command.CommandId' \
  --output text)"

echo "ssm_command_id=${COMMAND_ID}"

TARGET_COUNT="0"
for _ in $(seq 1 6); do
  TARGET_COUNT="$(aws ssm list-command-invocations --region "${AWS_REGION}" --command-id "${COMMAND_ID}" --query 'length(CommandInvocations)' --output text 2>/dev/null || echo 0)"
  if [[ "${TARGET_COUNT}" != "0" ]]; then
    break
  fi
  echo "SSM command was created, but no target invocation is registered yet. Waiting for target registration..."
  sleep 5
done

if [[ "${TARGET_COUNT}" == "0" ]]; then
  echo "No SSM targets matched ${TOMOTONO_SSM_TARGET_KEY}=${TOMOTONO_SSM_TARGET_VALUE} in ${AWS_REGION}." >&2
  echo "Ensure the EC2 instance is SSM-managed, online, in ${AWS_REGION}, and tagged for this target." >&2
  exit 1
fi

if [[ "${TOMOTONO_WAIT_FOR_COMPLETION}" != "true" ]]; then
  exit 0
fi

for _ in $(seq 1 80); do
  INVOCATIONS_JSON="$(aws ssm list-command-invocations --region "${AWS_REGION}" --command-id "${COMMAND_ID}" --details --output json)"
  INVOCATIONS_FILE="$(mktemp)"
  printf '%s' "${INVOCATIONS_JSON}" > "${INVOCATIONS_FILE}"
  STATUS_SUMMARY="$(python3 - "${INVOCATIONS_FILE}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)

items = payload.get("CommandInvocations", [])
if not items:
    print("NO_TARGETS")
    sys.exit(1)

statuses = [item.get("Status", "Unknown") for item in items]
print(",".join(statuses))
if all(status == "Success" for status in statuses):
    sys.exit(0)
if any(status in {"Cancelled", "TimedOut", "Failed", "Cancelling"} for status in statuses):
    sys.exit(2)
sys.exit(1)
PY
)" && STATUS_CODE=0 || STATUS_CODE=$?
  rm -f "${INVOCATIONS_FILE}"
  echo "ssm_status=${STATUS_SUMMARY}"
  if [[ "${STATUS_CODE}" == "0" ]]; then
    exit 0
  fi
  if [[ "${STATUS_CODE}" == "2" ]]; then
    echo "SSM deploy command failed. Inspect command ${COMMAND_ID}." >&2
    exit 1
  fi
  sleep 10
done

echo "Timed out waiting for SSM command ${COMMAND_ID}." >&2
exit 1
