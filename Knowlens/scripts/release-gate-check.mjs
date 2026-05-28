#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function normalizeBaseUrl(input) {
  const raw = (input || "").trim();
  if (!raw) {
    return "";
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function parseEnvFile(content) {
  const out = {};
  const lines = content.split(/\r?\n/g);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvFromFile(filePath) {
  if (!filePath) {
    return {};
  }
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    return {};
  }
  const content = fs.readFileSync(absolutePath, "utf8");
  return parseEnvFile(content);
}

function asBool(value, fallback = false) {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function isPlaceholder(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized.includes("replace-with") ||
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    normalized.includes("todo") ||
    normalized === "xxx" ||
    normalized === "test"
  );
}

const MATRIX = {
  local: {
    required: [
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID",
      "IMAGE2_PROVIDER_ENDPOINT",
      "IMAGE2_PROVIDER_API_KEY",
      "IMAGE2_PROVIDER_MODEL",
      "PAID_LLM_CHAT_COMPLETIONS_URL",
      "PAID_LLM_API_KEY",
      "GPTSAPI_API_KEY",
    ],
    optional: [
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_ESSENTIAL_MONTHLY",
      "NEXT_PUBLIC_STRIPE_ESSENTIAL_YEARLY",
      "NEXT_PUBLIC_STRIPE_CREATOR_MONTHLY",
      "NEXT_PUBLIC_STRIPE_CREATOR_YEARLY",
      "NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY",
      "NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY",
      "OPENAI_API_KEY",
      "NEXTAUTH_ALLOW_DEV_LOGIN",
    ],
  },
  staging: {
    required: [
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
      "NEXT_PUBLIC_SITE_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID",
      "IMAGE2_PROVIDER_ENDPOINT",
      "IMAGE2_PROVIDER_API_KEY",
      "IMAGE2_PROVIDER_MODEL",
      "PAID_LLM_CHAT_COMPLETIONS_URL",
      "PAID_LLM_API_KEY",
      "GPTSAPI_API_KEY",
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_ESSENTIAL_MONTHLY",
      "NEXT_PUBLIC_STRIPE_ESSENTIAL_YEARLY",
      "NEXT_PUBLIC_STRIPE_CREATOR_MONTHLY",
      "NEXT_PUBLIC_STRIPE_CREATOR_YEARLY",
      "NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY",
      "NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY",
    ],
    optional: [
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_YEARLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_YEARLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_YEARLY",
      "OPENAI_API_KEY",
      "NEXTAUTH_ALLOW_DEV_LOGIN",
    ],
  },
  production: {
    required: [
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
      "NEXT_PUBLIC_SITE_URL",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "NEXT_PUBLIC_GOOGLE_ONE_TAP_CLIENT_ID",
      "IMAGE2_PROVIDER_ENDPOINT",
      "IMAGE2_PROVIDER_API_KEY",
      "IMAGE2_PROVIDER_MODEL",
      "PAID_LLM_CHAT_COMPLETIONS_URL",
      "PAID_LLM_API_KEY",
      "GPTSAPI_API_KEY",
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_ESSENTIAL_MONTHLY",
      "NEXT_PUBLIC_STRIPE_ESSENTIAL_YEARLY",
      "NEXT_PUBLIC_STRIPE_CREATOR_MONTHLY",
      "NEXT_PUBLIC_STRIPE_CREATOR_YEARLY",
      "NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY",
      "NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY",
    ],
    optional: [
      "OPENAI_API_KEY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER_YEARLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR_YEARLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_MONTHLY",
      "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO_YEARLY",
    ],
  },
};

function printSection(title) {
  process.stdout.write(`\n=== ${title} ===\n`);
}

function ok(message) {
  process.stdout.write(`[PASS] ${message}\n`);
}

function warn(message) {
  process.stdout.write(`[WARN] ${message}\n`);
}

function fail(message) {
  process.stdout.write(`[FAIL] ${message}\n`);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { response, data, text };
}

async function runHttpChecks(baseUrl, runImage2Smoke) {
  const failures = [];
  const warnings = [];
  const checks = [];

  const providers = await fetchJson(`${baseUrl}/api/auth/providers`, { method: "GET" });
  if (!providers.response.ok) {
    failures.push(`GET /api/auth/providers failed (${providers.response.status})`);
  } else {
    checks.push("GET /api/auth/providers");
  }

  const redirect = await fetch(`${baseUrl}/api/billing/redirect?target=${encodeURIComponent("https://checkout.stripe.com/pay/test_gate")}`, {
    method: "GET",
    redirect: "manual",
  });
  if (![302, 303, 307, 308].includes(redirect.status)) {
    failures.push(`GET /api/billing/redirect failed (${redirect.status})`);
  } else {
    const location = redirect.headers.get("location") || "";
    if (!location.startsWith("https://")) {
      failures.push("Stripe redirect location is not HTTPS.");
    } else {
      checks.push("GET /api/billing/redirect");
    }
  }

  const workspaceStart = await fetchJson(`${baseUrl}/api/workspace/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "gate-check",
      textModel: "gemini-2.5",
      imageModel: "gpt-image2",
      sources: [],
    }),
  });
  if (![200, 401].includes(workspaceStart.response.status)) {
    failures.push(`POST /api/workspace/start unexpected status (${workspaceStart.response.status})`);
  } else {
    checks.push("POST /api/workspace/start");
  }

  if (runImage2Smoke) {
    const smoke = await fetchJson(`${baseUrl}/api/workspace/image2-smoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!smoke.response.ok || !smoke.data?.ok) {
      failures.push(
        `POST /api/workspace/image2-smoke failed (${smoke.response.status}): ${smoke.data?.error?.message || smoke.data?.error || "unknown"}`,
      );
    } else {
      checks.push("POST /api/workspace/image2-smoke");
    }
  } else {
    warnings.push("Image2 smoke was skipped. Use --image2-smoke true for real provider validation.");
  }

  return { failures, warnings, checks };
}

async function main() {
  const args = parseArgs(process.argv);
  const stageRaw = (args.stage || process.env.RELEASE_STAGE || "staging")
    .trim()
    .toLowerCase();
  const stage = stageRaw === "prod" ? "production" : stageRaw;
  const matrix = MATRIX[stage];
  if (!matrix) {
    process.stderr.write(
      `Unsupported stage "${stageRaw}". Use one of: local, staging, production.\n`,
    );
    process.exit(1);
  }

  const envFilePath = args["env-file"] || "";
  const fileEnv = loadEnvFromFile(envFilePath);
  const mergedEnv = { ...fileEnv, ...process.env };
  const baseUrl = normalizeBaseUrl(args["base-url"] || mergedEnv.NEXTAUTH_URL || "");
  const runHttp = asBool(args["http-check"], true);
  const runImage2Smoke = asBool(args["image2-smoke"], false);

  let hasFailure = false;

  printSection("Release Gate Input");
  ok(`stage=${stage}`);
  ok(`baseUrl=${baseUrl || "(none)"}`);
  ok(`envFile=${envFilePath || "(not provided)"}`);

  printSection("Environment Matrix Validation");
  for (const key of matrix.required) {
    const value = mergedEnv[key];
    if (!value) {
      fail(`missing required env: ${key}`);
      hasFailure = true;
      continue;
    }
    if (isPlaceholder(value)) {
      fail(`required env looks placeholder: ${key}`);
      hasFailure = true;
      continue;
    }
    ok(`required env ready: ${key}`);
  }
  for (const key of matrix.optional) {
    const value = mergedEnv[key];
    if (!value) {
      warn(`optional env missing: ${key}`);
      continue;
    }
    if (isPlaceholder(value)) {
      warn(`optional env placeholder-like value: ${key}`);
      continue;
    }
    ok(`optional env ready: ${key}`);
  }

  if (runHttp) {
    printSection("HTTP Gate Checks");
    if (!baseUrl) {
      fail("baseUrl is required for HTTP checks. Use --base-url or set NEXTAUTH_URL.");
      hasFailure = true;
    } else {
      try {
        const result = await runHttpChecks(baseUrl, runImage2Smoke);
        for (const item of result.checks) {
          ok(item);
        }
        for (const item of result.warnings) {
          warn(item);
        }
        for (const item of result.failures) {
          fail(item);
          hasFailure = true;
        }
      } catch (error) {
        hasFailure = true;
        const message = error instanceof Error ? error.message : String(error);
        fail(`HTTP checks crashed: ${message}`);
      }
    }
  } else {
    printSection("HTTP Gate Checks");
    warn("Skipped by --http-check false");
  }

  printSection("Gate Result");
  if (hasFailure) {
    fail("Release gate FAILED. Fix failures before gray rollout.");
    process.exit(1);
  }
  ok("Release gate PASSED. You can continue to gray rollout.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`\n[release-gate-check] crashed: ${message}\n`);
  process.exit(1);
});

