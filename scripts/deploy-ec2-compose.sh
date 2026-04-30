#!/usr/bin/env bash
set -euo pipefail
: "${EC2_HOST:?Set EC2_HOST}"
: "${EC2_USER:=ubuntu}"
ssh "$EC2_USER@$EC2_HOST" 'cd /opt/tomotono-route-console && git pull --ff-only && docker compose up -d --build'
