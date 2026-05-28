# KnowLens Gray Release Runbook

Last updated: 2026-05-28

## Goal

Build a repeatable release pipeline for:

- Local development verification
- Staging gray validation with real integrations
- Production canary rollout with rollback safety

## A. Recommended Environment Setup

### A1) Environment names

- `local`: developer machine only
- `staging`: public pre-release environment (real APIs, test billing mode)
- `production`: live environment

### A2) Suggested domain mapping

- Local: `http://localhost:3000`
- Staging: `https://staging.knowlens.ai`
- Production: `https://knowlens.ai`

### A3) Vercel mapping (recommended)

- One project, three environments:
  - Development
  - Preview (treat as staging)
  - Production
- Or two projects:
  - `knowlens-staging`
  - `knowlens-prod`

Use the matrix file to fill variables:

- [gray-release-environment-matrix.md](/Users/daichuanqing/Documents/Scilens/Knowlens/docs/gray-release-environment-matrix.md)
- Staging template: [env.staging.example](/Users/daichuanqing/Documents/Scilens/Knowlens/docs/templates/env.staging.example)
- Production template: [env.production.example](/Users/daichuanqing/Documents/Scilens/Knowlens/docs/templates/env.production.example)

### A4) Shared local SQLite for the 4 workstreams

To let `main`, `ui`, `qa`, and `server` read/write the same local data set, set the same path in every worktree:

- `KNOWLENS_DB_PATH=/Users/daichuanqing/.knowlens/shared/knowlens.sqlite`

This keeps:

- projects
- credits
- upload jobs
- subscriptions
- ops events

in one shared local database while you switch between worktrees.

## B. Release Pipeline

### Step 1: Local gate

Run:

```bash
npm run release:gate-check -- --stage local --env-file .env.local --base-url http://localhost:3000 --http-check true
```

Required outcome:

- Environment variable checks pass
- Basic API checks pass

### Step 2: Staging deploy + full gate

Run:

```bash
npm run release:gate-check -- --stage staging --base-url https://staging.knowlens.ai --http-check true --image2-smoke true
node scripts/regression-stripe-checkout.mjs --base-url https://staging.knowlens.ai --plan pro --cycle yearly --auth cookie --cookie "<NEXTAUTH_COOKIE>"
node scripts/usability-system-test.mjs --base-url https://staging.knowlens.ai
```

Required outcome:

- Payment chain works end to end
- Generation chain works end to end
- Upload extraction chain works end to end

### Step 3: Production canary

Recommended traffic plan:

1. 5% (30-60 min)
2. 20% (1-2 h)
3. 50% (2-4 h)
4. 100% (after sign-off)

At each step:

- Watch auth/billing/image/download error logs
- Check admin dashboard stats and error panels
- Stop and rollback if critical thresholds are hit

## C. Operational Checklist

Use:

- [gray-release-gate-checklist.md](/Users/daichuanqing/Documents/Scilens/Knowlens/docs/gray-release-gate-checklist.md)

This checklist is your release sign-off artifact.

## D. What Was Added in Code

1. Release gate script:
   - `scripts/release-gate-check.mjs`
2. NPM command:
   - `npm run release:gate-check`
3. New docs:
   - Environment matrix
   - Gate checklist
   - This runbook

## E. Fast Commands

```bash
# Local
npm run release:gate-check -- --stage local --env-file .env.local --base-url http://localhost:3000

# Staging
npm run release:gate-check -- --stage staging --base-url https://staging.knowlens.ai --image2-smoke true

# Production pre-check
npm run release:gate-check -- --stage production --base-url https://knowlens.ai
```

## F. Notes

- The release gate script validates presence and sanity of critical env vars.
- For real payment verification, run Stripe regression with a signed-in cookie.
- For real image provider verification, run `--image2-smoke true`.
- For production stability, use canary stages with explicit rollback triggers.
