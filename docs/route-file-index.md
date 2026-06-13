# KnowLens Route And File Index

## Public Pages
- `/` -> `src/app/page.tsx`
- `/landing` -> `src/app/landing/page.tsx`
- `/app` -> `src/app/app/page.tsx`
- `/workspace` -> `src/app/workspace/page.tsx`
- `/membership` -> `src/app/membership/page.tsx`
- `/membership/credits` -> `src/app/membership/credits/page.tsx`
- `/membership/subscription` -> `src/app/membership/subscription/page.tsx`
- `/projects` -> `src/app/projects/page.tsx`
- `/profile` -> `src/app/profile/page.tsx`
- `/blog` -> `src/app/blog/page.tsx`
- `/contact` -> `src/app/contact/page.tsx`
- `/feedback` -> `src/app/feedback/page.tsx`
- `/privacy` -> `src/app/privacy/page.tsx`
- `/terms` -> `src/app/terms/page.tsx`
- `/payment-terms` -> `src/app/payment-terms/page.tsx`
- `/upgrades` -> `src/app/upgrades/page.tsx`

## Admin Pages
- `/admin` -> `src/app/admin/page.tsx`
- `/admin/tickets` -> `src/app/admin/tickets/page.tsx`
- `/admin/subscriptions` -> `src/app/admin/subscriptions/page.tsx`
- `/admin/credits` -> `src/app/admin/credits/page.tsx`

## Workspace
- Entry controller -> `src/app/workspace/WorkspacePageClient.tsx`
- Route wrapper -> `src/app/workspace/page.tsx`
- Chat panel -> `src/components/workspace/ChatPanel.tsx`
- Draft panel -> `src/components/workspace/DraftPanel.tsx`
- Poster canvas -> `src/components/workspace/PosterCanvas.tsx`
- Storyboard canvas -> `src/components/workspace/StoryboardCanvas.tsx`
- Top bar -> `src/components/workspace/TopBar.tsx`
- Quick actions -> `src/components/workspace/QuickActions.tsx`
- Workflow sidebar -> `src/components/workspace/WorkflowSidebar.tsx`

## Auth And Session
- Auth config -> `src/lib/nextAuth.ts`
- Role resolution -> `src/lib/auth.ts`
- Session provider -> `src/components/auth/AuthSessionProvider.tsx`
- Sidebar nav role gating -> `src/components/app-shell/SidebarNav.tsx`
- Admin shell role gating -> `src/components/admin/AdminShell.tsx`

## Core Server Services
- Database bootstrap -> `src/lib/server/db.ts`
- Data store / ops events -> `src/lib/server/store.ts`
- Upload service -> `src/lib/server/upload.ts`
- Image provider orchestration -> `src/lib/server/image2.ts`
- Stripe helpers -> `src/lib/server/stripe.ts`
- Rate limit config -> `src/lib/server/rate-limit-config.ts`
- Rate limit helper -> `src/lib/server/rate-limit.ts`
- Guard helper -> `src/lib/server/guard.ts`
- Admin auth helper -> `src/lib/server/admin-auth.ts`

## Important APIs
- `/api/auth/[...nextauth]` -> NextAuth
- `/api/auth/google-onetap/verify` -> Google One Tap verify
- `/api/telemetry/event` -> generic telemetry
- `/api/telemetry/client-log` -> client logs for admin lookup
- `/api/admin/logs` -> admin log lookup
- `/api/admin/ops-summary` -> ops summary dashboard
- `/api/admin/checkout-stats` -> checkout source stats
- `/api/workspace/start` -> workspace start
- `/api/workspace/chat-guard` -> prompt guard
- `/api/workspace/intent-triage` -> intent triage
- `/api/workspace/generation-confirm` -> poster / ppt / video generation confirm
- `/api/workspace/image2-smoke` -> image2 smoke test
- `/api/content/poster-draft` -> poster draft generation
- `/api/export/ppt` -> ppt export
- `/api/export/video` -> video export
- `/api/upload/jobs` -> upload jobs
- `/api/billing/checkout` -> Stripe checkout
- `/api/billing/finalize` -> Stripe finalization
- `/api/billing/credits` -> credits query
- `/api/billing/redirect` -> billing redirect
