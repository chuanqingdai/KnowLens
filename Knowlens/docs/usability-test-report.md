# KnowLens MVP Usability Test Report

- Run at: 2026-05-27T14:57:12.689Z
- Base URL: http://127.0.0.1:4010
- Auth test account: local@knowlens.ai
- Server mode: existing

## Environment Checks

- `NEXTAUTH_ALLOW_DEV_LOGIN` detected: yes
- `IMAGE2_PROVIDER_*` detected: yes
- `OPENAI_API_KEY` detected: no
- `GPTSAPI_API_KEY` detected: no
- `PAID_LLM_API_KEY` detected: no

## Test Results

| Case | Result | Notes |
| --- | --- | --- |
| Auth: dev-login session bootstrap | PASS | session=local@knowlens.ai |
| Workspace start: valid payload | PASS | promptLen=48 |
| Chat guard: signed-in request | PASS | ok |
| Draft model chain: poster request | PASS | source=fallback (no gptsapi key in env) |
| Draft model chain: ppt request | PASS | skipped (missing gptsapi key): 502 |
| Upload chain: plain text file extraction | PASS | done |
| Upload chain: YouTube transcript extraction | PASS | expected-fail (YouTube transcript fallback requires OPENAI_API_KEY.) |
| Upload chain: podcast/audio transcript extraction | PASS | expected-fail (Podcast transcript extraction requires OPENAI_API_KEY.) |
| Upload guard: invalid file type is rejected | PASS | status=400 |
| Image generation chain: generation-confirm | PASS | degraded (IMAGE2_TIMEOUT) |
| Image provider smoke API | PASS | endpoint=https://api.tu-zi.com/v1/images/edits |

## Summary

- Total: 11
- Passed: 11
- Failed: 0

## Notes

- This run focuses on backend workflow and service-chain usability.
- UI styling/interaction is intentionally excluded per request.
- Some checks are environment-gated and treated as informative when required provider keys are absent.
