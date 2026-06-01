# KnowLens Codex Rules

## KnowLens Local Execution Rules

Highest priority. These rules override any older local-command conventions below.

- KnowLens project root is:

```bash
/Users/daichuanqing/Documents/Scilens/knowlens
```

- Before running any project command, always run:

```bash
pwd
```

- If `pwd` is not the project root, run:

```bash
cd /Users/daichuanqing/Documents/Scilens/knowlens
```

- Never run `npm run dev` or `npm run build` from:

```bash
/Users/daichuanqing
~
```

- Before any npm command, always verify `package.json` exists:

```bash
ls package.json
```

- Before each fix or commit, run this preflight:

```bash
pwd
git branch --show-current
git status --short
ls package.json
```

- Local start fixed flow:

```bash
cd /Users/daichuanqing/Documents/Scilens/knowlens
npm run dev
```

- Build validation fixed flow:

```bash
cd /Users/daichuanqing/Documents/Scilens/knowlens
npm run build
```

- Never commit these local/generated files:
  - `.next`
  - `node_modules`
  - `runtime-logs`
  - `*.log`
  - `.env`
  - `.env.local`
  - `tsconfig.tsbuildinfo`
  - `.DS_Store`

## 1. Project root

- Follow **KnowLens Local Execution Rules** above as the highest-priority root and preflight guard.
- Project root to use for command execution: `/Users/daichuanqing/Documents/Scilens/knowlens`.
- Never use `/Users/daichuanqing/Documents/Scilens` as the command root.
- Before running npm, confirm `package.json` exists in the current directory.
- If `package.json` is not found, stop and locate the correct app root instead of continuing.
- Do not assume the parent folder is the app root.

Correct root:

```bash
/Users/daichuanqing/Documents/Scilens/knowlens
```

Wrong root:

```bash
/Users/daichuanqing/Documents/Scilens
/Users/daichuanqing
~
```

## 2. Core principle

Codex should remain fully capable of real development work.

These rules are not meant to block Codex from coding, debugging, refactoring, running commands, or solving problems. They are meant to reduce wasted work, wrong assumptions, permission loops, accidental large rewrites, and repeated scanning of irrelevant files.

Default behavior:

* Understand the task first.
* Inspect only relevant files first.
* Explain the likely cause before changing code.
* Propose the smallest safe plan.
* Edit code when the task requires it.
* Keep changes reviewable.
* Escalate scope when the task clearly needs it.

Codex should not avoid important work. It should keep the work aligned with the user's current goal.

## 3. Allowed development work

Codex may:

* Read files.
* Search code.
* Modify code.
* Add new files.
* Refactor relevant modules.
* Run lint checks.
* Run type checks.
* Run build checks.
* Run tests.
* Inspect Git status and diffs.
* Start the local dev server when explicitly requested.
* Debug ports when explicitly requested.
* Edit config files when explicitly requested.
* Perform Git operations when explicitly requested.
* Make larger changes when the user explicitly asks for a large refactor, rollback, migration, or feature implementation.

Do not treat these rules as a ban on development. Treat them as execution discipline.

## 4. Search scope

Avoid scanning or editing these folders unless explicitly necessary:

* `node_modules`
* `.next`
* `dist`
* `build`
* `.git`
* generated assets
* cache folders
* large export folders

For normal code search, prefer targeted folders:

* `app`
* `components`
* `lib`
* `hooks`
* `server`
* `services`
* `utils`
* `types`
* `styles`

If a broader search is necessary, explain why before doing it.

## 5. Patch size and change control

Default patch rule:

* Prefer modifying no more than 3 to 5 files per task.
* Prefer keeping total diff under 300 to 500 lines.
* If a larger change is necessary, stop first and explain:

  * why the larger change is required
  * which files will be touched
  * which behavior may be affected
  * how to verify safely
  * how to roll back

Large changes are allowed when the user explicitly asks for:

* full feature implementation
* major refactor
* architecture cleanup
* rollback
* migration
* system-level repair

Do not turn a small bug fix into a broad rewrite.

## 6. Port and dev-server operations

Port operations are allowed when the user explicitly asks to start, stop, restart, or debug the local dev server.

When explicitly authorized, Codex may run:

```bash
lsof -nP -iTCP:<port> -sTCP:LISTEN
ps aux | grep -E "next|node|npm" | grep -v grep
npm run dev -- --hostname 127.0.0.1 --port <port>
npm run dev -- --hostname 0.0.0.0 --port <port>
pkill -f "next dev"
kill -9 <PID>
```

Rules for port tasks:

* Use `127.0.0.1` for local-only debugging.
* Use `0.0.0.0` only when access from other devices is needed.
* Prefer port 3000 when auth/OAuth config depends on 3000.
* If 3000 is blocked and cannot be identified quickly, use 3001 as a temporary fallback.
* Warn that login callbacks, environment variables, or OAuth settings may still point to 3000 when using 3001.
* Before `kill -9 <PID>`, show the PID and process name.
* Before `pkill -f "next dev"`, explain that it stops local Next.js dev servers.
* Do not repeatedly retry the same port cleanup command.
* If permission approval times out, stop and give the user the exact manual command instead of looping.

## 7. Commands requiring explicit authorization

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
```

Also require explicit authorization for:

* deleting files or directories outside the project root
* modifying remote branches
* overwriting local code with remote code
* clearing large folders
* starting long-running dev servers
* changing secrets or production environment variables

If the user explicitly asks for port cleanup, service recovery, hard rollback, GitHub overwrite, or deployment repair, Codex may use the relevant commands after stating what will happen.

## 8. Git workflow

Before risky changes, inspect:

```bash
git status
git diff --stat
git diff --numstat | sort -nr | head -30
```

If there are many uncommitted changes:

* warn the user before adding more changes
* explain whether the working tree is clean or dirty
* recommend saving a patch before rollback or large edits

Before rollback or overwrite, suggest backing up:

```bash
git diff > ~/Desktop/knowlens-current.patch
```

Use `git pull` only when merge is intended.

Use this only when the user explicitly wants remote GitHub code to overwrite local code:

```bash
git fetch origin
git reset --hard origin/<branch>
git clean -fd
```

Do not push broken or unverified code.

## 9. Performance optimization tasks

For performance work, first identify the real bottleneck:

* Codex itself slow
* Next dev server startup slow
* route compilation slow
* page interaction slow
* React state update slow
* API request slow
* storage write slow
* logging slow
* auth/session slow
* database slow
* image generation slow

For Workspace performance tasks, inspect likely hot paths first:

* Workspace page
* Workspace state hooks
* message update logic
* chat history persistence
* localStorage writes
* sessionStorage writes
* `console.info`
* `console.debug`
* audit logs
* large object logging
* frequent effects
* unnecessary re-renders

Preferred low-risk optimizations:

* Gate noisy logs behind explicit debug flags.
* Default dev audit logs to silent unless explicitly enabled.
* Avoid logging large objects in render/update paths.
* Debounce high-frequency storage writes.
* Avoid writing unchanged data to localStorage/sessionStorage.
* Use try/catch around storage writes.
* Flush pending storage writes on `visibilitychange` or `beforeunload`.
* Do not change message schema unless required.
* Do not change business flow unless the task explicitly requires it.

Recommended debug flag pattern:

```env
NEXT_PUBLIC_WORKSPACE_DEBUG=true
```

Default should be silent unless this flag is enabled.

## 10. Conversation-flow tasks

For conversation-flow work, do not rewrite the whole flow first.

Inspect in this order:

* input disabled state
* `onChange` handler
* submit handler
* first input requirement detection
* intent detection
* create project API
* create conversation API
* `router.push`
* loading states
* auth/session dependency
* credit check dependency
* fallback behavior when intent detection fails

If the issue started after a specific refactor, prefer:

* targeted diagnosis
* minimal fix
* targeted rollback

Avoid touching unrelated modules such as auth, payment, credits, Stripe, Google OAuth, or environment variables unless directly required.

## 11. Login and local port behavior

If local service runs on 3001 but login jumps to 3000, inspect:

* `.env.local`
* `NEXTAUTH_URL`
* `AUTH_URL`
* `NEXT_PUBLIC_APP_URL`
* `NEXT_PUBLIC_SITE_URL`
* `NEXT_PUBLIC_BASE_URL`
* `callbackUrl`
* redirect callbacks
* OAuth callback configuration
* hardcoded localhost URLs

Do not assume this is only a port problem. It may be an environment variable, auth callback, or hardcoded redirect issue.

When editing env files:

* do not print secret values
* preserve existing secrets
* show only key names and intended changes
* create a backup if needed
* never overwrite `.env.local` blindly

## 12. Environment variables

Do not change environment variables unless the task explicitly requires it.

Before changing env files:

* list exact keys to change
* explain why
* preserve secrets
* do not expose secret values
* create a backup if necessary

For browser-exposed debug flags, use `NEXT_PUBLIC_*`.

Example:

```env
NEXT_PUBLIC_WORKSPACE_DEBUG=true
```

## 13. Testing and verification

After code changes, output:

1. files changed
2. why each file changed
3. approximate diff size
4. whether auth/payment/credits/env were affected
5. manual verification steps
6. expected behavior after the fix
7. risks and rollback method

For local verification, prefer:

```bash
npm run lint
npm run build
```

Run tests if available.

Do not run long-running dev server unless the user asked for it.

## 14. Stop conditions

Stop and ask for direction when:

* approval repeatedly times out
* command output contradicts assumptions
* project root is uncertain
* patch would exceed planned scope
* unrelated modules need modification
* risky Git operation is required
* production config may be affected
* secrets may be exposed
* task has shifted from the original goal
* the same fix has failed twice

Do not continue guessing in these cases.

## 15. Standard operating modes

Use these modes depending on the user request.

### Read-only audit mode

Use when the user asks to investigate, analyze, or locate a problem.

Rules:

* Do not modify code.
* Do not run dev server.
* Do not run risky commands.
* Inspect only relevant files.
* Output likely causes and recommended next steps.

### Small fix mode

Use when the user asks for a specific bug fix or low-risk optimization.

Rules:

* Modify only relevant files.
* Keep diff small.
* Avoid unrelated modules.
* Run lightweight verification if appropriate.
* Explain changes and risks.

### Port recovery mode

Use only when the user explicitly asks for local service or port help.

Rules:

* Confirm project root.
* Inspect the port.
* Start the requested dev server.
* Use `kill` / `pkill` only with explicit authorization.
* Stop if approval times out.

### Large change mode

Use when the user explicitly asks for a major refactor, rollback, GitHub overwrite, or feature implementation.

Rules:

* Check Git status first.
* Suggest backup patch.
* Explain scope.
* Make the change in controlled steps.
* Verify after completion.
