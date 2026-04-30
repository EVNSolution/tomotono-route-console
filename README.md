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

Default local admin password is `admin` if `ADMIN_PASSWORD` is not set. Set a strong password before any shared deployment.

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
5. Run `docker compose up -d --build`.

## Data safety

Do not commit raw customer CSV files. Use anonymized/synthetic fixtures only. Avoid logging full addresses or coordinates in production logs.
