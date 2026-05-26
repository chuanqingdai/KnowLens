# Rate Limit 上线配置与验收（MVP）

## 1) 当前已接入限流的关键接口

- `POST /api/billing/checkout`
- `POST /api/upload/jobs`
- `POST /api/feedback`
- `POST /api/feedback/[id]/reply`
- `POST /api/featured/metrics/[caseId]/like`
- `POST /api/featured/metrics/[caseId]/view`
- `POST /api/content/poster-draft`
- `POST /api/auth/google-onetap/verify`
- `POST /api/workspace/start`（新建项目入口）
- `POST /api/workspace/chat-guard`（对话频控闸门）

---

## 2) 生产推荐阈值（可按业务再调）

- `RATE_LIMIT_BILLING_CHECKOUT_LIMIT=6`
- `RATE_LIMIT_BILLING_CHECKOUT_WINDOW_SECONDS=600`

- `RATE_LIMIT_UPLOAD_JOB_CREATE_LIMIT=12`
- `RATE_LIMIT_UPLOAD_JOB_CREATE_WINDOW_SECONDS=60`

- `RATE_LIMIT_FEEDBACK_CREATE_LIMIT=4`
- `RATE_LIMIT_FEEDBACK_CREATE_WINDOW_SECONDS=600`

- `RATE_LIMIT_FEEDBACK_REPLY_LIMIT=20`
- `RATE_LIMIT_FEEDBACK_REPLY_WINDOW_SECONDS=600`

- `RATE_LIMIT_FEATURED_LIKE_LIMIT=30`
- `RATE_LIMIT_FEATURED_LIKE_WINDOW_SECONDS=60`

- `RATE_LIMIT_FEATURED_VIEW_LIMIT=90`
- `RATE_LIMIT_FEATURED_VIEW_WINDOW_SECONDS=60`

- `RATE_LIMIT_CONTENT_POSTER_DRAFT_LIMIT=20`
- `RATE_LIMIT_CONTENT_POSTER_DRAFT_WINDOW_SECONDS=300`

- `RATE_LIMIT_AUTH_GOOGLE_ONETAP_VERIFY_LIMIT=20`
- `RATE_LIMIT_AUTH_GOOGLE_ONETAP_VERIFY_WINDOW_SECONDS=300`

- `RATE_LIMIT_APP_START_GENERATE_LIMIT=24`
- `RATE_LIMIT_APP_START_GENERATE_WINDOW_SECONDS=600`

- `RATE_LIMIT_WORKSPACE_CHAT_INPUT_LIMIT=120`
- `RATE_LIMIT_WORKSPACE_CHAT_INPUT_WINDOW_SECONDS=3600`

- `ABUSE_GUARD_DAILY_NEW_PROJECT_LIMIT=40`
- `ABUSE_GUARD_DAILY_CHAT_ONLY_LIMIT=120`

说明：
- `ABUSE_GUARD_DAILY_NEW_PROJECT_LIMIT`：每天新建会话上限（按用户/IP）。
- `ABUSE_GUARD_DAILY_CHAT_ONLY_LIMIT`：只聊天不确认生成的日上限（按用户/IP）。

---

## 3) Vercel 配置动作

1. 打开 `Project -> Settings -> Environment Variables`
2. 按上面的 key/value 填入 Production（Preview 可先复用）
3. 触发 redeploy

---

## 4) 验收标准

目标：短时间高频请求被限制，但正常用户不受影响。

### A. 高频压测（应触发 429）

示例（本地）：

```bash
for i in {1..10}; do
  curl -i -X POST 'http://localhost:3000/api/feedback' \
    -H 'Content-Type: application/json' \
    -d '{"type":"bug","detail":"test","contact":"qa@knowlens.ai"}' | head -n 1
done
```

期望：前几次 `200`，达到阈值后返回 `429`，并带 `Retry-After` 响应头。

### B. 正常节奏（不应触发 429）

- 同一用户每分钟内 1~2 次文稿生成、偶尔上传、少量点赞浏览
- 期望：全部正常，不出现误伤

### C. 登录验证接口

- 连续快速触发 One Tap verify，超过阈值后应返回 `429`
- 正常登录节奏不受影响

### D. 新建项目频控

- 高频点击首页 `Generate` 按钮，超过阈值后应返回 `429`
- 文案提示应为“新建项目次数过多，请稍后再试”

### E. 对话防刷熔断

- 仅发送对话、不确认账单生成，连续触发超过阈值后应返回 `429`
- 完成一次账单确认后，熔断计数会被“生成确认”抵扣，不影响正常创作

---

## 5) 运维建议

- 观察上线后 24h 的 429 比例：若正常用户投诉升高，先小幅上调对应接口 limit。
- 支付与上传接口优先保守，点赞浏览可相对宽松。
- 长期建议把 rate-limit 统计接入监控面板（按 endpoint 聚合）。
- 重点监控 `workspace:start` 与 `workspace:chat_input` 两个端点，防止 token 被纯对话拖空。
- 对所有模型接口返回体，禁止返回内部策略 prompt（仅返回产物字段）。
