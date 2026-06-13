# KnowLens Vercel Stripe 变量核对清单 + 一键回归脚本

## 1) Vercel 变量核对清单（Production / Preview）

在 `Vercel -> Project -> Settings -> Environment Variables` 中核对以下项。

### A. 必填（支付与登录主链路）

1. `NEXTAUTH_URL`
   - Production: `https://knowlens.ai`
   - Preview: 对应 preview 域名（建议也设置为生产域，按你的策略）

2. `NEXTAUTH_SECRET`
   - 32+ 字符随机字符串

3. `GOOGLE_CLIENT_ID`
   - 你的 Google OAuth Client ID

4. `GOOGLE_CLIENT_SECRET`
   - 你的 Google OAuth Client Secret

5. `NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID`
   - 与 `GOOGLE_CLIENT_ID` 一致

6. `STRIPE_SECRET_KEY`
   - `sk_live_...`（生产）或 `sk_test_...`（测试）
   - 不能是占位值 `replace-with-stripe-secret-key`

7. Stripe 订阅 Price IDs（你已配置过）
   - `NEXT_PUBLIC_STRIPE_ESSENTIAL_MONTHLY`
   - `NEXT_PUBLIC_STRIPE_ESSENTIAL_YEARLY`
   - `NEXT_PUBLIC_STRIPE_CREATOR_MONTHLY`
   - `NEXT_PUBLIC_STRIPE_CREATOR_YEARLY`
   - `NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY`
   - `NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY`

### B. 建议填（兜底跳转）

当 `STRIPE_SECRET_KEY` 临时异常时，可回退到 Stripe Payment Link：

- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_MONTHLY`
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_YEARLY`
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_MONTHLY`
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_YEARLY`
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_MONTHLY`
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_YEARLY`

### C. 回归测试辅助（仅非生产建议）

- `NEXTAUTH_ALLOW_DEV_LOGIN=true`
  - 用于自动化脚本登录 `dev-login` provider（仅测试环境使用）
  - Production 建议为 `false`

---

## 2) 回归目标定义

链路目标：
1. 点击订阅（调用 `/api/billing/checkout`）成功返回 `checkoutUrl`
2. `checkoutUrl` 可跳转到 Stripe（`https://*.stripe.com`）
3. 支付回跳链路可达（`/membership?checkout=success&session_id=...` -> `/api/billing/finalize`）

---

## 3) 一键回归脚本

脚本路径：

`scripts/regression-stripe-checkout.mjs`

### 脚本覆盖的检查

1. 鉴权可用（dev-login 或 session cookie）
2. `POST /api/billing/checkout` 成功
3. `checkoutUrl` 为平台重定向接口 `/api/billing/redirect?...`
4. 重定向响应 `Location` 指向 Stripe 域名
5. `POST /api/billing/finalize` 可达并返回预期状态
   - 未支付 session：返回 pending 状态（可接受）
   - 已支付 session：返回成功（若传 `--paid-session-id`）

### 快速执行（本地）

```bash
cd /Users/daichuanqing/Documents/Scilens/Knowlens
node scripts/regression-stripe-checkout.mjs --base-url http://localhost:3000 --plan pro --cycle yearly
```

### 快速执行（线上）

```bash
cd /Users/daichuanqing/Documents/Scilens/Knowlens
node scripts/regression-stripe-checkout.mjs --base-url https://knowlens.ai --plan pro --cycle yearly --auth cookie --cookie "<YOUR_NEXTAUTH_COOKIE_HEADER>"
```

---

## 4) 常用参数

- `--base-url`：站点地址（默认 `http://localhost:3000`）
- `--plan`：`starter | pro | scale`（默认 `pro`，对应 Creator）
- `--cycle`：`monthly | yearly`（默认 `yearly`）
- `--auth`：`auto | dev | cookie`（默认 `auto`）
- `--cookie`：已登录用户 cookie（`auth=cookie` 时必填）
- `--expected-host`：可选，强制校验 Stripe Host（例如 `checkout.stripe.com`）
- `--paid-session-id`：可选，传真实已支付 session id，用于验证 finalize 成功路径

---

## 5) 验收标准（建议）

通过标准：

1. Checkout API 返回 `ok=true` 且带 `checkoutUrl`
2. `/api/billing/redirect` 返回 302/303/307/308 且 `location` 为 Stripe 域名
3. finalize 接口可达：
   - 未支付：返回 pending（状态可解释）
   - 已支付：`ok=true`

失败常见原因：

- `STRIPE_SECRET_KEY` 仍为占位值或填错环境
- Price ID 不匹配当前 Stripe account / mode（test vs live）
- 用户未登录导致 checkout 401
- 域名环境变量不一致导致回跳 URL 异常

---

## 6) 推荐上线前最小流程

1. 在 Preview 环境执行脚本一次（dev-login 模式）
2. 在 Production 环境执行脚本一次（cookie 模式）
3. 用真实测试卡完成一次支付，拿到 `paid-session-id` 再跑一次 finalize 成功校验
4. 通过后再发版
