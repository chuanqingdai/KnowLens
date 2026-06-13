# KnowLens Gray Release Environment Matrix

Last updated: 2026-05-28

## 1) Environment Topology

- `Local`: developer machine (`http://localhost:3000`)
- `Staging` (gray test): public pre-release domain, real third-party services, non-production keys
- `Production`: `https://knowlens.ai`, live keys, real users

## 2) Variable Matrix (Must-Have)

| Key | Local | Staging | Production | Notes |
|---|---|---|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` | `https://staging.knowlens.ai` | `https://knowlens.ai` | Must match deployed domain |
| `NEXTAUTH_SECRET` | required | required | required | 32+ random characters |
| `AUTH_SECRET` | optional | optional | optional | Fallback alias for platforms using `AUTH_SECRET` |
| `NEXT_PUBLIC_SITE_URL` | optional | required | required | Canonical and redirect base |
| `GOOGLE_CLIENT_ID` | required | required | required | OAuth app config must include callback |
| `GOOGLE_CLIENT_SECRET` | required | required | required | Never expose client secret |
| `NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID` | required | required | required | Same as `GOOGLE_CLIENT_ID` |
| `STRIPE_SECRET_KEY` | recommended | required | required | Staging: `sk_test_`; Prod: `sk_live_` |
| `NEXT_PUBLIC_STRIPE_ESSENTIAL_MONTHLY` | optional | required | required | Stripe Price ID |
| `NEXT_PUBLIC_STRIPE_ESSENTIAL_YEARLY` | optional | required | required | Stripe Price ID |
| `NEXT_PUBLIC_STRIPE_CREATOR_MONTHLY` | optional | required | required | Stripe Price ID |
| `NEXT_PUBLIC_STRIPE_CREATOR_YEARLY` | optional | required | required | Stripe Price ID |
| `NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY` | optional | required | required | Stripe Price ID |
| `NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY` | optional | required | required | Stripe Price ID |
| `PAID_LLM_CHAT_COMPLETIONS_URL` | required | required | required | Paid LLM endpoint |
| `PAID_LLM_API_KEY` | required | required | required | Shared key supports multiple paid models |
| `GPTSAPI_API_KEY` | required | required | required | Free model provider key |
| `IMAGE2_PROVIDER_ENDPOINT` | required | required | required | Current tu-zi Image2 endpoint |
| `IMAGE2_PROVIDER_API_KEY` | required | required | required | Image generation key |
| `IMAGE2_PROVIDER_MODEL` | required | required | required | `gpt-image-2` |

## 3) Variable Matrix (Recommended)

| Key | Local | Staging | Production | Notes |
|---|---|---|---|---|
| `OPENAI_API_KEY` | optional | recommended | recommended | YouTube/podcast fallback transcription |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_*` | optional | recommended | recommended | Stripe fallback links |
| `NEXTAUTH_ALLOW_DEV_LOGIN` | `true` | `false` | `false` | Should be disabled in any public environment |
| `NEXTAUTH_RELAX_OAUTH_CHECKS_LOCAL` | `true` | `false` | `false` | Only for localhost |
| `NEXTAUTH_ONE_TAP_UNSAFE_LOCAL_FALLBACK` | `true` | `false` | `false` | Local troubleshooting only |
| `NEXTAUTH_COOKIE_DOMAIN` | empty | optional | recommended | Set `.knowlens.ai` when serving both apex and subdomains |
| `NEXTAUTH_SHARE_COOKIE_ACROSS_SUBDOMAINS` | `false` | optional | recommended | `true` enables auto domain sharing from `NEXTAUTH_URL` |

## 4) OAuth Callback Matrix

You must configure all callback URLs in Google Cloud Console:

- Local: `http://localhost:3000/api/auth/callback/google`
- Staging: `https://staging.knowlens.ai/api/auth/callback/google`
- Production: `https://knowlens.ai/api/auth/callback/google`

If one callback is missing, that environment will fail with OAuth sign-in errors.

Production callback hard rule:
- Keep only apex callback for production: `https://knowlens.ai/api/auth/callback/google`
- Do not keep `https://www.knowlens.ai/api/auth/callback/google` in production app config.
- Rationale: runtime and middleware are locked to apex (`knowlens.ai`) and `www -> apex` redirect is enabled. Keeping mixed callback hosts can cause login loops or repeated sign-in.

## 5) Stripe Mode Matrix

| Environment | Stripe Mode | Required |
|---|---|---|
| Local | test | Optional for dev; required for full payment E2E |
| Staging | test | Mandatory |
| Production | live | Mandatory |

Never mix test Price IDs with live secret keys.

## 6) Data & Storage Policy

- Local:
  - Default SQLite path is shared across all local worktrees:
    - `~/.knowlens/shared/knowlens.sqlite`
  - Override with `KNOWLENS_DB_PATH` when needed.
- Staging/Production:
  - Avoid ephemeral SQLite for core business data.
  - Use persistent external DB for users/projects/credits/payments.

## 7) Quick Validation Commands

```bash
# Local
npm run release:gate-check -- --stage local --env-file .env.local --base-url http://localhost:3000 --http-check true

# Staging
npm run release:gate-check -- --stage staging --base-url https://staging.knowlens.ai --http-check true --image2-smoke true

# Production (pre-release window)
npm run release:gate-check -- --stage production --base-url https://knowlens.ai --http-check true
```
