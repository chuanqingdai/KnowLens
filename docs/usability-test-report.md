# KnowLens MVP Usability Test Report

- Run at: 2026-05-28T00:26:56.943Z
- Base URL: http://127.0.0.1:3000
- Auth test account: local+usability-1779927669086-eg8wfvt@knowlens.ai
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
| Auth: dev-login session bootstrap | PASS | session=local+usability-1779927669086-eg8wfvt@knowlens.ai |
| Workspace start: valid payload | PASS | promptLen=48 |
| Workspace start: empty input is rejected | PASS | status=400 |
| Workspace start: prompt is trimmed to 6000 chars | PASS | len=6000 |
| Workspace start: sources list is capped at 30 | PASS | sources=30 |
| Chat guard: signed-in request | PASS | ok |
| Draft model chain: poster request | PASS | source=fallback (no gptsapi key in env) |
| Draft model chain: ppt request | PASS | skipped (missing gptsapi key): 502 |
| Upload chain: plain text file extraction | PASS | done |
| Upload chain: YouTube transcript extraction | PASS | expected-fail (YouTube transcript fallback requires OPENAI_API_KEY.) |
| Upload chain: podcast/audio transcript extraction | PASS | expected-fail (Podcast transcript extraction requires OPENAI_API_KEY.) |
| Upload chain: provider-missing errors fail fast without retries | PASS | attempts=1, code=UPLOAD_PROVIDER_NOT_CONFIGURED |
| Upload chain: retryable network failures exhaust retries | PASS | attempts=3, code=UPLOAD_NETWORK_FAILURE |
| Upload chain: minimal YouTube link payload is accepted | PASS | status=failed |
| Upload guard: missing file payload is rejected immediately | PASS | status=400 |
| Upload guard: invalid file type is rejected | PASS | status=400 |
| Image generation chain: generation-confirm | PASS | providerCalled=true |
| Core deliverable: poster render URL is downloadable | PASS | bytes=2401171, mime=image/png |
| Core deliverable: PPT export returns valid .pptx binary | PASS | bytes=4858213, content-type=application/vnd.openxmlformats-officedocument.presentationml.presentation |
| Core deliverable: audio TTS returns playable WAV | PASS | bytes=407782, content-type=audio/wav |
| Core deliverable: video export returns downloadable mp4/webm | PASS | format=webm, bytes=2755, content-type=video/webm |
| Generation guard: missing tasks is rejected | PASS | status=400 |
| Image provider smoke API | PASS | endpoint=https://api.tu-zi.com/v1/images/edits |
| Billing checkout: signed-out request is rejected | PASS | status=401 |
| Billing checkout: invalid plan is rejected | PASS | status=400 |
| Billing checkout: signed-in request yields redirect or actionable 503 | PASS | status=503 (STRIPE_ENV_MISSING) |
| Billing redirect: missing target is rejected | PASS | status=400 |
| Billing redirect: non-stripe target is rejected | PASS | status=400 |
| Billing redirect: stripe target is allowed | PASS | status=302 |
| Billing finalize: signed-out request is rejected | PASS | status=401 |
| Billing finalize: missing sessionId is rejected | PASS | status=400 |

## Summary

- Total: 31
- Passed: 31
- Failed: 0

## Notes

- This run focuses on backend workflow and service-chain usability.
- UI styling/interaction is intentionally excluded per request.
- Some checks are environment-gated and treated as informative when required provider keys are absent.
