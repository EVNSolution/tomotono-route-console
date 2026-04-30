# Tomotono Route Console MVP Design

## Architecture
A dedicated GitHub repository hosts a Next.js App Router service. The app provides an admin-gated operations console, API route handlers, an isolated EasyRoutes CSV parser, Prisma/PostgreSQL schema, and Docker Compose deployment assets for EC2 in `ca-central-1`.

## UI Direction
The UI follows root `DESIGN.md`: dark-mode-native, near-black canvas, Inter Variable, translucent panels, subtle borders, high-density operations tables, and restrained indigo/violet accents only for state and primary actions.

## MVP Features
- Admin login gate before route data is visible.
- CSV import endpoint and UI for EasyRoutes export files.
- Delivery day and route queue grouped from CSV rows.
- Route detail screen with marker sequence and Google Maps integration fallback.
- Stop panel for status, delivery tip, and dispatcher memo updates.
- Route confirmation action and review log seam.
- Settings/security page for timezone, region, Maps key, and PII controls.

## Data Policy
Real CSV files must not be committed. Included sample data is synthetic/anonymized. Secrets live in `.env` only.
