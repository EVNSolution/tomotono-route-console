#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${TOMOTONO_REPO_URL:-https://github.com/EVNSolution/tomotono-route-console.git}"
DEPLOY_BRANCH="${TOMOTONO_DEPLOY_BRANCH:-main}"
DEPLOY_DIR="${TOMOTONO_DEPLOY_DIR:-/opt/tomotono-route-console}"
APP_TIMEZONE="${APP_TIMEZONE:-America/Toronto}"
AWS_REGION_VALUE="${AWS_REGION:-${TOMOTONO_AWS_REGION:-ca-central-1}}"
POSTGRES_USER_VALUE="${POSTGRES_USER:-tomotono}"
POSTGRES_PASSWORD_VALUE="${POSTGRES_PASSWORD:-tomotono_dev_password}"
POSTGRES_DB_VALUE="${POSTGRES_DB:-tomotono_route_console}"
POSTGRES_DATA_DIR_VALUE="${POSTGRES_DATA_DIR:-/mnt/tomotono-postgres/data}"
ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-admin}"
ADMIN_SESSION_TOKEN_VALUE="${ADMIN_SESSION_TOKEN:-local-dev-session-change-me}"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY_VALUE="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_VALUE="${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID:-}"
GOOGLE_MAPS_SERVER_API_KEY_VALUE="${GOOGLE_MAPS_SERVER_API_KEY:-}"

if id ec2-user >/dev/null 2>&1; then
  DEPLOY_USER="${TOMOTONO_DEPLOY_USER:-ec2-user}"
elif id ubuntu >/dev/null 2>&1; then
  DEPLOY_USER="${TOMOTONO_DEPLOY_USER:-ubuntu}"
else
  DEPLOY_USER="${TOMOTONO_DEPLOY_USER:-$(id -un)}"
fi

as_root() {
  if [[ "$(id -u)" == "0" ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

run_as_deploy_user() {
  if [[ "$(id -un)" == "${DEPLOY_USER}" ]]; then
    "$@"
  else
    as_root sudo -u "${DEPLOY_USER}" "$@"
  fi
}

start_docker() {
  if command -v systemctl >/dev/null 2>&1; then
    as_root systemctl enable --now docker
  elif command -v service >/dev/null 2>&1; then
    as_root service docker start
  fi
}

buildx_meets_min_version() {
  local current min_version
  min_version="0.17.0"
  current="$(
    docker buildx version 2>/dev/null \
      | awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^v?[0-9]+[.][0-9]+[.][0-9]+/) { gsub(/^v/, "", $i); print $i; exit } }'
  )"

  [[ -n "${current}" ]] || return 1
  [[ "$(printf '%s\n%s\n' "${min_version}" "${current}" | sort -V | head -n 1)" == "${min_version}" ]]
}

install_buildx_fallback() {
  if buildx_meets_min_version; then
    return
  fi

  local arch buildx_version
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *)
      echo "Unsupported CPU architecture for Docker Buildx fallback: $(uname -m)" >&2
      exit 1
      ;;
  esac

  buildx_version="${TOMOTONO_BUILDX_VERSION:-}"
  if [[ -z "${buildx_version}" ]]; then
    buildx_version="$(
      curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest \
        | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' \
        | head -n 1
    )"
  fi
  [[ -n "${buildx_version}" ]] || { echo "Unable to resolve Docker Buildx release version." >&2; exit 1; }
  [[ "${buildx_version}" == v* ]] || buildx_version="v${buildx_version}"

  as_root mkdir -p /usr/local/lib/docker/cli-plugins
  as_root curl -fsSL "https://github.com/docker/buildx/releases/download/${buildx_version}/buildx-${buildx_version}.linux-${arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-buildx
  as_root chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
  buildx_meets_min_version
}

install_compose_fallback() {
  if docker compose version >/dev/null 2>&1; then
    return
  fi

  local arch
  case "$(uname -m)" in
    x86_64|amd64) arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    *)
      echo "Unsupported CPU architecture for Docker Compose fallback: $(uname -m)" >&2
      exit 1
      ;;
  esac

  as_root mkdir -p /usr/local/lib/docker/cli-plugins
  as_root curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  as_root chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  docker compose version >/dev/null
}

install_runtime() {
  if command -v dnf >/dev/null 2>&1; then
    as_root dnf install -y git docker
    if ! command -v curl >/dev/null 2>&1; then
      as_root dnf install -y curl-minimal || as_root dnf install -y curl --allowerasing
    fi
    as_root dnf install -y docker-compose-plugin || true
  elif command -v yum >/dev/null 2>&1; then
    as_root yum install -y git docker
    if ! command -v curl >/dev/null 2>&1; then
      as_root yum install -y curl-minimal || as_root yum install -y curl --allowerasing
    fi
    as_root yum install -y docker-compose-plugin || true
  elif command -v apt-get >/dev/null 2>&1; then
    as_root apt-get update -y
    as_root apt-get install -y ca-certificates curl git docker.io
    as_root apt-get install -y docker-compose-plugin || true
  else
    echo "Unsupported Linux distribution: dnf, yum, or apt-get is required." >&2
    exit 1
  fi

  start_docker
  install_buildx_fallback
  install_compose_fallback

  if id "${DEPLOY_USER}" >/dev/null 2>&1; then
    as_root usermod -aG docker "${DEPLOY_USER}" || true
  fi
}

prepare_repo() {
  as_root mkdir -p "$(dirname "${DEPLOY_DIR}")"
  as_root chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$(dirname "${DEPLOY_DIR}")"

  if [[ -d "${DEPLOY_DIR}/.git" ]]; then
    run_as_deploy_user git -C "${DEPLOY_DIR}" fetch --prune origin
    run_as_deploy_user git -C "${DEPLOY_DIR}" checkout -B "${DEPLOY_BRANCH}" "origin/${DEPLOY_BRANCH}"
    run_as_deploy_user git -C "${DEPLOY_DIR}" reset --hard "origin/${DEPLOY_BRANCH}"
  elif [[ -e "${DEPLOY_DIR}" && -n "$(find "${DEPLOY_DIR}" -mindepth 1 -maxdepth 1 2>/dev/null || true)" ]]; then
    echo "${DEPLOY_DIR} exists and is not an empty git checkout. Move it or set TOMOTONO_DEPLOY_DIR." >&2
    exit 1
  else
    run_as_deploy_user git clone --branch "${DEPLOY_BRANCH}" "${REPO_URL}" "${DEPLOY_DIR}"
  fi
}

write_env_if_missing() {
  local env_file="${DEPLOY_DIR}/.env"
  if [[ -f "${env_file}" && "${TOMOTONO_OVERWRITE_ENV:-false}" != "true" ]]; then
    append_env_entry "${env_file}" "POSTGRES_DATA_DIR" "${POSTGRES_DATA_DIR_VALUE}"
    echo "Existing ${env_file} preserved."
    return
  fi

  as_root tee "${env_file}" >/dev/null <<EOF_ENV
DATABASE_URL="postgresql://${POSTGRES_USER_VALUE}:${POSTGRES_PASSWORD_VALUE}@db:5432/${POSTGRES_DB_VALUE}?schema=public"
POSTGRES_USER="${POSTGRES_USER_VALUE}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD_VALUE}"
POSTGRES_DB="${POSTGRES_DB_VALUE}"
POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR_VALUE}"
ADMIN_PASSWORD="${ADMIN_PASSWORD_VALUE}"
ADMIN_SESSION_TOKEN="${ADMIN_SESSION_TOKEN_VALUE}"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY_VALUE}"
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_VALUE}"
GOOGLE_MAPS_SERVER_API_KEY="${GOOGLE_MAPS_SERVER_API_KEY_VALUE}"
APP_TIMEZONE="${APP_TIMEZONE}"
AWS_REGION="${AWS_REGION_VALUE}"
EOF_ENV
  as_root chown "${DEPLOY_USER}:${DEPLOY_USER}" "${env_file}"
  as_root chmod 600 "${env_file}"
  echo "Created ${env_file}."
}

append_env_entry() {
  local env_file="$1"
  local key="$2"
  local value="$3"

  if ! as_root grep -q "^${key}=" "${env_file}"; then
    printf '%s="%s"\n' "${key}" "${value}" | as_root tee -a "${env_file}" >/dev/null
    as_root chown "${DEPLOY_USER}:${DEPLOY_USER}" "${env_file}"
    as_root chmod 600 "${env_file}"
    echo "Added ${key} to ${env_file}."
  fi
}

prepare_postgres_data_dir() {
  if [[ "${POSTGRES_DATA_DIR_VALUE}" != /* ]]; then
    return
  fi

  if [[ "${POSTGRES_DATA_DIR_VALUE}" == /mnt/tomotono-postgres/* ]] && command -v mountpoint >/dev/null 2>&1; then
    mountpoint -q /mnt/tomotono-postgres || {
      echo "/mnt/tomotono-postgres is not mounted. Attach and mount the Postgres EBS volume first." >&2
      exit 1
    }
  fi

  as_root mkdir -p "${POSTGRES_DATA_DIR_VALUE}"
  as_root chmod 700 "${POSTGRES_DATA_DIR_VALUE}"
}

compose() {
  if run_as_deploy_user docker compose version >/dev/null 2>&1; then
    run_as_deploy_user docker compose "$@"
  else
    as_root docker compose "$@"
  fi
}

wait_for_database() {
  for _ in $(seq 1 60); do
    if compose exec -T db pg_isready -U "${POSTGRES_USER_VALUE}" -d "${POSTGRES_DB_VALUE}" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done

  echo "Timed out waiting for PostgreSQL to accept connections." >&2
  exit 1
}

deploy_compose() {
  cd "${DEPLOY_DIR}"
  compose up -d db
  wait_for_database
  compose build app migrate
  compose run --rm migrate
  compose up -d app
  compose ps
}

main() {
  install_runtime
  prepare_repo
  write_env_if_missing
  prepare_postgres_data_dir
  deploy_compose
  echo "Tomotono route console deployed from ${DEPLOY_BRANCH} into ${DEPLOY_DIR}."
}

main "$@"
