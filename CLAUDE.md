# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dashboard-turismo` — internal operations dashboard for **TurismoChileTours** (San Pedro de Atacama, Chile). Production app actively polished with end users. Covers sales/quotations, calendar/events, receptions, transfers, agencies, providers, cash flow, commissions, billing, approvals, alerts, analytics, users and roles.

## Commands

Package manager: **pnpm only** (never npm/yarn/bun/npx). Version pinned via `packageManager` in `package.json`.

```bash
pnpm dev                # next dev --turbopack
pnpm build              # next build --turbopack
pnpm start              # next start (production)
pnpm lint               # eslint
pnpm production:build   # prisma generate && next build (Vercel build)

pnpm test:unit          # vitest unit suite (no DB, fast)
pnpm test:integration   # vitest integration suite (requires Docker)
pnpm test:e2e           # playwright E2E suite (requires Docker + build)
pnpm test:coverage      # unit suite + v8 coverage report → ./coverage/

pnpm prisma migrate dev --name <name>   # create + apply migration
pnpm prisma migrate deploy              # production migrations
pnpm prisma generate                    # regenerate client into src/generated/prisma
pnpm tsx prisma/seed/<file>.ts          # run a seed script
```

Strict TDD mode is active — see `TESTING.md` for the full testing guide (layers, conventions, troubleshooting).

CLI substitutions (per global rules): use `bat`, `rg`, `fd`, `sd`, `eza` instead of `cat/grep/find/sed/ls`.

## Stack

- **Next.js 16** (App Router, Turbopack, React Compiler enabled) + **React 19**
- **Prisma 7** with `@prisma/adapter-pg` against **Neon PostgreSQL** (client generated to `src/generated/prisma`, NOT `node_modules/.prisma`)
- **Better Auth 1.4** (`src/lib/auth.ts` server, `src/lib/auth-client.ts` client) — admin plugin + roles
- **TanStack Query / Table / Form / Virtual**, **Zustand** for client state
- **shadcn/ui** + **Radix** + **Tailwind 4** (`@/components/ui/*`)
- **Zod 4** for schemas, **dnd-kit** for drag/drop, **@react-pdf/renderer** + **exceljs** for exports
- **Vercel** hosting, **Vercel Blob** for files, **Resend** + **@react-email** for email
- TS path aliases: `@/*` → `src/*`, `@generated/*` → prisma generated client

## Architecture

Clean / Screaming Architecture by feature. Two top-level layers under `src/`:

- **`src/app/`** — Next.js App Router. Routes use Spanish slugs that mirror UI labels (e.g. `dashboard/registro-de-ventas`, `dashboard/control-de-salidas`, `dashboard/flujo-de-caja`). Route files are thin — they import from `src/project/<domain>`. `src/app/api/` holds route handlers (auth, webhooks, uploads).
- **`src/project/<domain>/`** — domain modules. Each module owns its own slice and typically contains:
  - `actions/` — **Next.js Server Actions** (the primary write path; not REST). E.g. `sales/actions/sale-record.actions.ts`.
  - `server/` — server-only queries/helpers (DB reads, computations)
  - `schemas/` — Zod schemas (input validation + types)
  - `components/` — feature React components (client + server)
  - `columns/` — TanStack Table column defs
  - `stores/` — Zustand stores (client state)
  - `hooks/`, `utils/`, `constants/`

Domains: `agency`, `alerts`, `analytics`, `approvals`, `auth`, `billing`, `calendar`, `cash-flow`, `commissions`, `departures`, `events`, `home`, `notifications`, `payment-statements`, `providers`, `receptions`, `roles`, `sales`, `tours`, `transfer-agencies`, `transfers`, `users`.

Shared / cross-cutting code:
- **`src/shared/`** — reusable components, hooks, providers, utils, generic server actions
- **`src/lib/`** — infrastructure singletons: `prisma.ts`, `auth.ts`, `auth-client.ts`, `audit/`, `email/`, `company-info.ts`
- **`src/components/ui/`** — shadcn primitives
- **`src/hooks/`** — global hooks

**Key invariant**: Prisma client is generated to `src/generated/prisma` and re-exported via `src/lib/prisma.ts`. Always import from `@/lib/prisma`, never from the generated path.

**Server actions over API routes**: domain mutations live as `"use server"` actions in `<domain>/actions/`. API routes exist only for auth, webhooks, and integrations that genuinely need HTTP endpoints.

## Conventions

- Conventional Commits only. No "Co-Authored-By" or AI attribution.
- Voseo (Rioplatense Spanish) is the user's language; UI strings and route slugs are Spanish.
- New feature work: create files inside the matching `src/project/<domain>/` folder. Don't put domain logic in `src/app/`.
- Validation lives in `schemas/` with Zod; never trust unvalidated input in server actions.
- Audit logging utilities are in `src/lib/audit/` — use them on sensitive mutations (sales, cash flow, approvals).

## Workflow

This project uses **SDD (Spec-Driven Development)** for substantial changes. Slash commands: `/sdd-new`, `/sdd-ff`, `/sdd-continue`, `/sdd-explore`, `/sdd-apply`, `/sdd-verify`, `/sdd-archive`. The orchestrator delegates each phase to a sub-agent and persists artifacts to **engram** (default artifact store for this repo).

Vercel deploy notes: pnpm is pinned via `packageManager` to avoid lockfile mismatches; `production:build` runs `prisma generate` before `next build`.

## Reference

- `README.md` — sales module spec (functional fields and business rules)
- `PROBLEMS.md` — running backlog from meetings with end users
- `docs/` — module-level implementation notes (`SALES_MODULE_IMPLEMENTATION.md`, `USERS_MODULE_IMPLEMENTATION.md`, `ALERTS.md`, `CHANGELOG_SALES.md`)
- `docs/timezone-runbook.md` — date handling: @db.Date fields, helpers in `src/shared/utils/calendar-day.ts`, deploy procedure, and how to add new calendar-day fields or actions
- `openspec/` — SDD change archives (when `openspec` mode is used)
- `prisma/schema.prisma` — canonical data model
