# Tomotono Route Console

Dark operations console MVP for importing EasyRoutes CSV delivery exports, reviewing route sequence/ETA data, adding delivery tips or dispatcher memos, and confirming routes before dispatch.

## Stack

- Next.js + TypeScript
- Tailwind CSS + shadcn-style Radix primitives
- Google Maps JavaScript API
- PostgreSQL + Prisma schema
- Docker Compose for EC2 deployment
- Default timezone: `America/Toronto`
- Target AWS region: `ca-central-1`

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Admin login is DB-backed. Create or update an `AdminUser` row in PostgreSQL before using the console; the default identifier used by the password-only MVP login form is `tomotono_admin` (`DEFAULT_ADMIN_IDENTIFIER`). Per-login sessions are stored in `admin_sessions`, and login/logout/security audit events are stored in `admin_login_logs`.

## Verification

```bash
npm test
npm run lint
npm run build
npx prisma validate
```

## Deployment sketch

1. Provision EC2 in `ca-central-1`.
2. Configure `.env` on the host; do not commit secrets.
3. Restrict browser Google Maps key by HTTP referrer.
4. Restrict server Google Maps key by server/IP.
5. (Optional temporary HTTPS) Set `TOMATONO_SSLIP_HOST` to `<public-ip>.sslip.io` and `CADDY_ADMIN_EMAIL`, then run:
   - `TOMATONO_SSLIP_HOST=... CADDY_ADMIN_EMAIL=... docker compose --profile sslip up -d --build app caddy`
   - This starts a temporary Caddy reverse proxy on ports `80/443` for TLS.
   - Without `--profile sslip`, app runs only on port `3000`.

## EC2 deploy

Deployment is prepared through GitHub Actions OIDC + AWS role ARN + SSM Run Command + Docker Compose. See `docs/ec2-deployment.md`. The deploy workflow intentionally skips browser smoke tests and only executes the EC2 compose rollout.

## Data safety

Do not commit raw customer CSV files. Use anonymized/synthetic fixtures only. Avoid logging full addresses or coordinates in production logs.

## Admin session operations

See `docs/admin-auth-operations.md` for EC2 `psql` queries, login audit inspection, and retention cleanup SQL.
