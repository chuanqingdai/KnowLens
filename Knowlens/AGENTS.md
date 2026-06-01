# KnowLens Codex Rules

## 1. Project root

The project root is:

```bash
/Users/daichuanqing/Documents/Scilens/Knowlens
```

Before running any project command, confirm:

```bash
pwd
ls package.json
```

If `package.json` is not found, stop and locate the correct root.

Never use these as the project root:

```bash
/Users/daichuanqing/Documents/Scilens
/Users/daichuanqing
~
```

Use this command pattern:

```bash
cd /Users/daichuanqing/Documents/Scilens/Knowlens
```

## 2. Core principle

Codex should remain fully capable of real development work.

These rules are not meant to block coding, debugging, refactoring, running checks, or solving problems. They are meant to reduce wasted work, wrong directories, permission loops, accidental large rewrites, and repeated scanning of irrelevant files.

Default behavior:

* Understand the task first.
* Stay inside the current task domain.
* Inspect only relevant files first.
* Prefer small, reviewable changes.
* Escalate scope only when the task clearly requires it.
* Stop and ask before risky or broad operations.

## 3. Task domain isolation

Each task should belong to one domain only.

Common domains:

* Landing page / marketing UI
* Conversation flow / input / intent detection
* Workspace performance
* Auth / OAuth / login
* Payment / credits / Stripe
* Local dev server / port recovery
* Deployment / Vercel / environment variables
* Git cleanup / rollback
* Codex workflow / AGENTS.md

Do not mix domains in one task unless the user explicitly asks.

Examples:

* Landing page tasks should not touch conversation flow, auth, payment, API, Workspace, or env files.
* Conversation-flow tasks should not touch landing page copy or layout.
* Port recovery tasks should not modify business code.
* Performance tasks should not change business semantics.
* Deployment tasks should not refactor UI.

## 4. Do not scan generated or heavy folders

Do not read, search, list, or analyze these folders unless the user explicitly asks:

```text
node_modules/
.next/
.git/
runtime-logs/
logs/
dist/
build/
out/
coverage/
.cache/
tmp/
temp/
generated/
exports/
public/generated/
public/exports/
```

Do not analyze these generated, binary, or heavy file types unless explicitly required:

```text
*.log
*.pack
*.pack.old
*.sst
*.map
*.cache
*.tmp
*.zip
*.tar
*.tgz
*.mp4
*.mov
*.webm
*.png
*.jpg
*.jpeg
*.gif
*.webp
*.pdf
*.pptx
*.docx
```

## 5. Source search rule

Do not run full-repository search by default.

Avoid:

```bash
find .
grep -R . .
rg . .
```

Search source folders first:

```bash
find app components lib hooks server services utils types styles -name "<filename>" -print 2>/dev/null
rg "<keyword>" app components lib hooks server services utils types styles
rg --files app components lib hooks server services utils types styles | grep -i "<keyword>"
```

Only expand search scope when targeted search fails. Explain why before broadening scope.

If a file path is already provided by the user, do not search for it. Open that file directly.

## 6. Fast edit mode

Use this mode for frontend copy, layout, style, or single-page display changes.

Rules:

* Use the file path provided by the user.
* Prefer editing only the target file.
* Do not search the whole project.
* Do not run build, lint, dev server, or broad git commands unless requested.
* Do not touch auth, payment, credits, API, env files, middleware, or unrelated modules.
* Do not create new abstractions unless necessary.
* Do not refactor business logic.

After editing, output only:

1. files changed
2. what changed
3. approximate diff size
4. whether business logic was affected
5. manual verification steps

If the user says “only modify this file,” obey strictly.

## 7. Read-only audit mode

Use this mode when the user asks to investigate, analyze, locate, or explain a problem.

Rules:

* Do not modify code.
* Do not run dev server.
* Do not run risky commands.
* Inspect only relevant files.
* Output likely causes, evidence, and the smallest next step.

Use read-only audit before fixing unclear bugs, performance issues, build failures, auth issues, and conversation-flow regressions.

## 8. Patch size control

Default rule:

* Prefer 1–3 files per task.
* Prefer diffs under 300 lines.
* If more than 5 files or 500 lines are needed, stop first and explain:

  * why the larger change is necessary
  * which files will be changed
  * what behavior may be affected
  * how to verify
  * how to roll back

Large changes are allowed only when the user explicitly asks for a major refactor, migration, rollback, or full feature implementation.

## 9. Commands and authorization

These commands require explicit user authorization in the current task:

```bash
sudo
pkill
kill
killall
rm -rf
git reset --hard
git clean
git push
git pull
npm run dev
```

Do not start long-running dev servers unless requested.

`npm run build`, lint, and tests may be used for validation when the task requires it, but do not run them by default for small frontend or copy edits.

If approval times out, stop and give the user the exact manual command. Do not retry in a loop.

## 10. Port and dev server tasks

Only handle ports or dev server when the user explicitly asks.

When authorized, use:

```bash
lsof -nP -iTCP:<port> -sTCP:LISTEN
ps aux | grep -E "next|node|npm" | grep -v grep
npm run dev -- --hostname 127.0.0.1 --port <port>
npm run dev -- --hostname 0.0.0.0 --port <port>
pkill -f "next dev"
kill -9 <PID>
```

Rules:

* Prefer `127.0.0.1` for local-only debugging.
* Prefer port `3000` when auth/OAuth depends on it.
* Use `3001` only as a temporary fallback.
* Before killing a process, show PID and process name.
* Do not repeatedly retry the same failed cleanup command.
* If port recovery fails, stop and give manual steps.

## 11. Git workflow

Before risky changes or large edits, inspect:

```bash
git status --short
git diff --stat
git diff --numstat | sort -nr | head -30
```

Avoid full `git diff` unless needed. Prefer path-limited diff:

```bash
git diff -- <path>
```

If there are many uncommitted changes, warn the user before adding more changes.

Before rollback or overwrite, suggest backup:

```bash
git diff > ~/Desktop/knowlens-current.patch
```

Do not push broken or unverified code.

Use `git pull` only when merge is intended.

Use `git fetch` + `git reset --hard origin/<branch>` only when the user explicitly wants GitHub remote code to overwrite local code.

## 12. Performance tasks

First identify the real bottleneck:

```text
Codex search slow
Git status/diff slow
Next dev server startup slow
route compilation slow
page interaction slow
React state update slow
API request slow
storage write slow
logging slow
auth/session slow
database slow
image generation slow
```

For Workspace performance, inspect first:

```text
console.info / console.debug
audit logs
large object logging
localStorage writes
sessionStorage writes
message update logic
Workspace state hooks
frequent effects
unnecessary re-renders
```

Preferred low-risk fixes:

* Gate noisy logs behind debug flags.
* Default logs to silent unless explicitly enabled.
* Debounce high-frequency storage writes.
* Avoid writing unchanged data.
* Use try/catch around storage writes.
* Flush pending writes on `visibilitychange` or `beforeunload`.

Use browser debug flags like:

```env
NEXT_PUBLIC_WORKSPACE_DEBUG=true
```

Do not change message schema or business semantics unless required.

## 13. Conversation-flow tasks

Do not rewrite the whole conversation flow first.

Inspect in this order:

```text
input disabled state
onChange handler
submit handler
first input requirement detection
intent detection
create project API
create conversation API
router.push
loading states
auth/session dependency
credit check dependency
fallback behavior
```

If the issue started after a specific refactor, prefer targeted diagnosis, minimal fix, or targeted rollback.

Do not touch auth, payment, credits, Stripe, Google OAuth, env files, or unrelated modules unless directly required.

## 14. Login and local port behavior

If local service runs on `3001` but login jumps to `3000`, inspect:

```text
.env.local
NEXTAUTH_URL
AUTH_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_BASE_URL
callbackUrl
redirect callbacks
OAuth callback configuration
hardcoded localhost URLs
```

Do not assume this is only a port problem. It may be an environment variable, auth callback, or hardcoded redirect issue.

## 15. Environment variables

Do not modify `.env.local` unless the task explicitly requires it.

Before changing env files:

* show key names only
* preserve secrets
* do not print secret values
* create a backup if needed
* never overwrite `.env.local` blindly

## 16. Validation strategy

Use layered validation.

For frontend copy, style, or landing-page edits:

* do not run build by default
* provide browser manual verification steps

For React logic, API, auth, payment, credits, or conversation flow:

* run focused checks when appropriate
* run build only when the task risk justifies it or before deployment

Before deployment:

```bash
npm run build
```

## 17. Stop conditions

Stop and ask for direction when:

```text
project root is uncertain
approval repeatedly times out
command output contradicts assumptions
patch would exceed planned scope
unrelated modules need modification
risky Git operation is required
production config may be affected
secrets may be exposed
the same fix has failed twice
task has shifted from the original goal
```

Do not continue guessing.
