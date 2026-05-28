# Stripe & Upload E2E Regression (Run Log)

- Run date: 2026-05-28
- Target: `http://localhost:3000`
- Scope:
  - Stripe success/cancel/failure callback loop validation
  - Upload timeout/retry/end-state error consistency validation
- UI changes: none

## 1) Stripe key readiness check (local)

Checked local runtime environment and `.env.local`:

- `STRIPE_SECRET_KEY`: placeholder (`replace-with-stripe-secret-key`)
- `STRIPE_API_KEY`: missing
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_*`: missing

Conclusion:

- Local environment cannot execute real paid Stripe success/failure end-to-end callbacks.
- Current environment can only verify:
  - checkout endpoint behavior under missing key
  - redirect target validation
  - finalize endpoint contract for signed-out/missing-session

## 2) Stripe callback loop validation status

### 2.1 Verified in this run (automated)

- `/api/billing/checkout` (signed-in):
  - returns actionable `503` with `STRIPE_ENV_MISSING` when key is absent.
- `/api/billing/redirect`:
  - rejects missing target (`400`)
  - rejects non-Stripe host (`400`)
  - accepts Stripe host and returns redirect (`302`)
- `/api/billing/finalize`:
  - signed-out request rejected (`401`)
  - missing `sessionId` rejected (`400`)

### 2.2 Real Stripe success/cancel/failure callback loop

Current status: **blocked by local key state** (no live/test secret available to local runtime).

What must be configured locally before real loop execution:

1. `STRIPE_SECRET_KEY` (test or live key)
2. Optional fallback links:
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_MONTHLY`
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_MONTHLY`
   - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_MONTHLY`
3. Ensure `/membership` return URL is reachable from Stripe dashboard callback settings.

## 3) Upload timeout/retry/end-state validation status

### 3.1 Verified in this run (automated)

- Provider-not-configured scenario:
  - fails fast in one attempt
  - error code: `UPLOAD_PROVIDER_NOT_CONFIGURED`
- Retryable network failure scenario:
  - retries until max attempt
  - final attempt count = 3
  - error code: `UPLOAD_NETWORK_FAILURE` (or timeout code when applicable)
- Missing file payload:
  - rejected immediately (`400`) without enqueuing
- Link-only YouTube payload:
  - accepted by API contract (job created and polled to terminal state)

### 3.2 Frontend end-state consistency hardening

Added deterministic mapping for upload failure codes to user-facing messages:

- `UPLOAD_PROVIDER_NOT_CONFIGURED`
- `UPLOAD_NETWORK_FAILURE`
- `UPLOAD_WORKER_TIMEOUT`
- `UPLOAD_INPUT_TOO_LARGE`
- `UPLOAD_INPUT_INVALID`
- `UPLOAD_SOURCE_FETCH_4XX`

Also prevents duplicate failure toasts for the same failed upload job id.

## 4) Summary

- Automated regression suite expanded and passed (`27/27`).
- Backend fixes for Stripe/upload reliability are active.
- Real Stripe paid callback loop (success/failure after hosted payment) is pending only on local key provisioning.
