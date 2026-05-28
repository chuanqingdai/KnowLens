# KnowLens Gray Release Gate Checklist

Last updated: 2026-05-28

## 1) Release Flow (Local -> Staging -> Production)

1. Local merge ready:
   - Core unit/API checks pass
   - No P0/P1 known bug open
2. Deploy to Staging:
   - Real third-party APIs enabled (Stripe test, model keys)
3. Staging gray test:
   - Internal team + allowlist users
4. Production canary:
   - Small traffic window (recommended 5% -> 20% -> 50% -> 100%)
5. Full production:
   - All gates pass and no alert spike

## 2) Gate Zero: Environment & Secrets

- [ ] All required variables filled for target environment
- [ ] No placeholder values (`replace-with-*`, `your_*`)
- [ ] Google OAuth callback URL matches environment domain
- [ ] Stripe keys and Price IDs are in correct mode (test/live)
- [ ] Image2 endpoint/key/model are valid
- [ ] Paid LLM + Free LLM keys both configured

Run:

```bash
npm run release:gate-check -- --stage staging --base-url https://staging.knowlens.ai --http-check true --image2-smoke true
```

## 3) Gate One: Auth & Session

- [ ] Google sign-in succeeds
- [ ] Returning users keep session after refresh
- [ ] OAuth failure message is user-readable and has error code
- [ ] One Tap fallback to normal Google button works

## 4) Gate Two: Payment Funnel

- [ ] Membership page exposure event is logged
- [ ] Checkout click event is logged
- [ ] `/api/billing/checkout` returns usable `checkoutUrl`
- [ ] Stripe page opens successfully (no local API key leak in UI)
- [ ] Finalize success updates subscription and credits
- [ ] Cancel/failure path does not add credits
- [ ] `checkout_source` daily/source stats show attempts and success rate

Suggested command:

```bash
node scripts/regression-stripe-checkout.mjs --base-url https://staging.knowlens.ai --plan pro --cycle yearly --auth cookie --cookie "<NEXTAUTH_COOKIE>"
```

## 5) Gate Three: Core Generation

- [ ] Text prompt -> draft generation succeeds
- [ ] Style selection -> billing -> confirm generation succeeds
- [ ] Image2 generates real accessible image URL
- [ ] Failed image tasks auto-retry and expose actionable error
- [ ] Credits deducted only on confirmation path

Suggested command:

```bash
node scripts/image2-smoke.mjs
```

## 6) Gate Four: Upload & Extraction

- [ ] File upload succeeds (PDF/DOCX/PPTX/image/audio/video)
- [ ] Upload timeout/retry gives consistent error message
- [ ] YouTube extraction works or fails with clear reason code
- [ ] Podcast extraction works or fails with clear reason code

Suggested command:

```bash
node scripts/usability-system-test.mjs --base-url https://staging.knowlens.ai
```

## 7) Gate Five: Export & Download

- [ ] Poster download success/failure logged
- [ ] PPT export succeeds and file is valid
- [ ] Video export succeeds or gives clear fallback behavior

## 8) Gate Six: Admin Observability

- [ ] Admin dashboard shows project total and active count
- [ ] Admin dashboard shows error total and recent key logs
- [ ] Error logs include: auth, llm, image, download, billing
- [ ] Error message text is specific enough for troubleshooting

API checks:

- `GET /api/admin/checkout-stats?days=14`
- `GET /api/admin/ops-summary?checkoutDays=14&errorLimit=80`

## 9) Gray Rollout Policy

### Staging exit criteria

- [ ] Gate Zero to Gate Six all pass
- [ ] No P0/P1 bug open
- [ ] 24h monitoring window has no repeated critical errors

### Production canary criteria

- Stage A (5% traffic, 30-60 min):
  - [ ] Login success rate stable
  - [ ] Checkout attempt and success trend stable
  - [ ] Image2 failures not above baseline
- Stage B (20% traffic, 1-2h):
  - [ ] No new critical error category
- Stage C (50% traffic, 2-4h):
  - [ ] Export/download error rate stable
- Stage D (100% traffic):
  - [ ] Final sign-off

## 10) Rollback Triggers

Immediate rollback if any:

- Login failure spike (auth errors)
- Payment success callback failures
- Incorrect credit deduction or duplicate crediting
- Image generation hard failure spike
- Download/export unavailable

Rollback actions:

1. Disable canary traffic / revert deployment
2. Keep payment pages accessible if possible, block new generation only if needed
3. Post incident note with error code and affected window

