# Project Brief — Tomotono Route Console

## Project connection

- project-start issue: `pending`
- change-control issue: `pending`
- target repo: `EVNSolution/tomotono-route-console`
- target service: `tomotono-route-console`
- template lineage: `clever-agent-project/docs/templates/target-repo-project-brief.md`

## Problem statement

Tomotono needs a safe delivery operations web MVP for reviewing EasyRoutes/Shopify-style CSV route exports before dispatch. The first version should help an operator quickly inspect delivery dates, routes, drivers, stop sequence, ETA/actual arrival data, address/order metadata, delivery tips, and final route review state.

## Expected result

An admin-gated Next.js operations console that imports an EasyRoutes CSV, normalizes it into delivery days/routes/stops, renders a dark high-density dashboard, provides a route detail map/review surface, supports stop memo/tip/status updates, and records route confirmation.

## Constraints

- UI must follow `DESIGN.md`: dark-mode-native, near-black background, Inter Variable, subtle translucent surfaces, restrained violet/indigo accents.
- Default timezone is `America/Toronto`.
- Deployment target is AWS Canada Central `ca-central-1`.
- Google Maps is the map platform.
- Raw customer CSV files, API keys, DB URLs, and production secrets must not be committed.
- Optimization engine, live Shopify/EasyRoutes API integration, and real customer notifications are out of MVP scope.

## Scope

### In scope

- Admin login gate.
- EasyRoutes CSV upload/parser.
- Delivery day and route queue dashboard.
- Route detail screen with Google Maps marker integration and no-key fallback.
- Stop status, delivery tip, and dispatcher memo editing.
- Route review confirmation.
- Prisma/PostgreSQL schema and Docker Compose deployment assets.
- CI workflow for test/lint/schema/build/docker-build checks.

### Out of scope

- Route optimization algorithm implementation.
- Shopify production account changes.
- EasyRoutes production setting changes.
- Real customer notification sending.
- Raw customer CSV fixture commits.

## Users and runtime

- primary user: Tomotono/EV&S delivery operations manager.
- operator or admin: authenticated admin user.
- runtime environment: Next.js app with PostgreSQL.
- deploy target: EC2 + Docker Compose in `ca-central-1`.

## Core features

1. Upload EasyRoutes CSV and parse delivery operation rows.
2. Review delivery-day and route summaries.
3. Inspect route stop order, ETA, actual arrival, address/order metadata, and map markers.
4. Edit delivery tips, dispatcher memos, and stop status.
5. Confirm route review completion.

## Data and contracts

- input data: EasyRoutes/Shopify CSV export.
- output data: normalized delivery imports, days, routes, stops, tips, and review logs.
- external systems: Google Maps JavaScript API; future EasyRoutes/Shopify/optimization APIs.
- public contract: internal admin web/API only for MVP.

## Verification

- local verification: `npm test`, `npm run lint`, `npx prisma validate`, `npm run build`.
- automated tests: parser grouping/timezone/address tests under `tests/lib/easyroutes-parser.test.ts`.
- smoke test: login, dashboard sample data, CSV upload, route detail, stop edit, route confirmation.
- release evidence: CI workflow and Docker image build.

## Open questions

- Final production domain.
- Google Maps billing/key ownership and restrictions.
- Whether operators will remain CSV-based or later need EasyRoutes/Shopify APIs.
- Final auth provider beyond MVP password gate.
- ETA notification channel and optimization API owner.

## Next tasks

1. Create project-start/change-control issues and link them to this repo.
2. Replace MVP in-memory store with Prisma persistence after DB migration approval.
3. Add browser smoke/e2e tests for login/import/review flows.
