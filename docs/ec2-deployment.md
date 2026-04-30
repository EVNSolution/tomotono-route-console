# EC2 Deployment Baseline

This repo deploys to EC2 through GitHub Actions OIDC, an AWS role ARN, SSM Run Command, and Docker Compose. The deploy workflow intentionally does not run browser smoke tests; it only dispatches and waits for the EC2 compose rollout command.

## GitHub variables

The workflow reads these variables, in order:

- AWS role ARN: `TOMOTONO_AWS_ROLE_ARN`, fallback `PROD_AWS_ROLE_ARN`, fallback `GH_ACTIONS_PROD_DEPLOY_ROLE_ARN`, then `GH_ACTIONS_INFRA_ROLE_ARN` / environment deploy role secrets used by EV&S deployment workflows. These can be GitHub organization/repository/environment variables or secrets; the deploy job runs in the `prod` environment so existing environment-level deploy role references can be reused. Do not use the ECR build-only role for this workflow; it is not trusted for this repo and does not represent the SSM deployment permission set.
- AWS region: `TOMOTONO_AWS_REGION`, fallback `ca-central-1`. The generic organization `AWS_REGION` is intentionally not used because this service targets Canada Central.
- SSM target: `TOMOTONO_SSM_TARGET_KEY` / `TOMOTONO_SSM_TARGET_VALUE`, default `tag:Service=tomotono-route-console`.
- Deploy directory: `TOMOTONO_DEPLOY_DIR`, default `/opt/tomotono-route-console`.
- Deploy branch: `TOMOTONO_DEPLOY_BRANCH`, default `main` for manual runs.
- Optional auto deploy switch: `TOMOTONO_DEPLOY_ENABLED=true` enables deploy on every `main` push.

## GitHub secrets

Optional but recommended before real delivery data is imported:

- `TOMOTONO_ADMIN_PASSWORD`
- `TOMOTONO_ADMIN_SESSION_TOKEN`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY`

If admin secrets are absent, the EC2 bootstrap script writes MVP fallback values so the container can start. Replace them before importing real CSV data. The generated EC2 `.env` is chmod `600` and is preserved on later deploys unless `TOMOTONO_OVERWRITE_ENV=true` is set.

## EC2 prerequisites

The target instance must:

1. Run in the configured AWS region, normally `ca-central-1`.
2. Be managed by AWS Systems Manager.
3. Match the SSM target tag, by default `Service=tomotono-route-console`.
4. Allow the GitHub OIDC role to call `ssm:SendCommand`, `ssm:ListCommandInvocations`, and related read actions for the target.
5. Have outbound internet access to clone the public GitHub repo and pull container images.

The script supports Amazon Linux (`dnf`/`yum`) and Ubuntu (`apt-get`). It installs Git, Docker, and Docker Compose plugin if missing, falls back to the latest Docker Compose v2 CLI plugin binary when the OS package is unavailable, clones or resets the repo, writes `.env` only if absent, and runs `docker compose up -d --build`.

## Manual deploy

From GitHub Actions, run `deploy-ec2` manually with defaults:

- branch: `main`
- target key: `tag:Service`
- target value: `tomotono-route-console`

No smoke test is included in this workflow.
