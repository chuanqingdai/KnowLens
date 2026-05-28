#!/usr/bin/env node
import process from "node:process";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) {
      continue;
    }
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function normalizeBaseUrl(value) {
  const raw = (value || "http://localhost:3002").trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function pickFirstCookieKV(cookieLine) {
  const first = cookieLine.split(";")[0] || "";
  const eqIndex = first.indexOf("=");
  if (eqIndex <= 0) {
    return null;
  }
  const name = first.slice(0, eqIndex).trim();
  const value = first.slice(eqIndex + 1).trim();
  if (!name) {
    return null;
  }
  return { name, value };
}

class CookieJar {
  constructor() {
    this.map = new Map();
  }

  addSetCookieLines(lines) {
    for (const line of lines) {
      const parsed = pickFirstCookieKV(line);
      if (!parsed) {
        continue;
      }
      this.map.set(parsed.name, parsed.value);
    }
  }

  addCookieHeader(headerValue) {
    if (!headerValue) {
      return;
    }
    const parts = headerValue.split(";");
    for (const part of parts) {
      const [nameRaw, ...rest] = part.split("=");
      const name = (nameRaw || "").trim();
      if (!name || rest.length === 0) {
        continue;
      }
      const value = rest.join("=").trim();
      this.map.set(name, value);
    }
  }

  toHeader() {
    if (this.map.size === 0) {
      return "";
    }
    return [...this.map.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function readSetCookies(response) {
  const headerApi = response.headers;
  if (typeof headerApi.getSetCookie === "function") {
    return headerApi.getSetCookie();
  }
  const combined = headerApi.get("set-cookie");
  if (!combined) {
    return [];
  }
  return combined.split(/,(?=[^;]+=[^;]+)/g);
}

async function fetchWithCookies(url, init, jar) {
  const headers = new Headers(init?.headers || {});
  const cookie = jar.toHeader();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const response = await fetch(url, {
    ...init,
    headers,
  });
  const setCookieLines = readSetCookies(response);
  if (setCookieLines.length > 0) {
    jar.addSetCookieLines(setCookieLines);
  }
  return response;
}

function logStep(title, detail = "") {
  const prefix = `\n[Stripe Regression] ${title}`;
  if (!detail) {
    process.stdout.write(`${prefix}\n`);
    return;
  }
  process.stdout.write(`${prefix}: ${detail}\n`);
}

function fail(message) {
  process.stderr.write(`\n[Stripe Regression] FAILED: ${message}\n`);
  process.exit(1);
}

async function ensureReachable(baseUrl, jar) {
  const res = await fetchWithCookies(`${baseUrl}/api/auth/providers`, { method: "GET" }, jar);
  if (!res.ok) {
    fail(`Base URL not reachable or auth providers failed (${res.status}). URL=${baseUrl}`);
  }
  return res.json();
}

async function loginWithDevProvider(baseUrl, jar, email, name) {
  logStep("Auth", "Using dev-login provider");
  const csrfRes = await fetchWithCookies(`${baseUrl}/api/auth/csrf`, { method: "GET" }, jar);
  if (!csrfRes.ok) {
    fail(`Cannot get CSRF token (${csrfRes.status})`);
  }
  const csrfData = await csrfRes.json();
  const csrfToken = (csrfData?.csrfToken || "").trim();
  if (!csrfToken) {
    fail("CSRF token is empty");
  }

  const body = new URLSearchParams({
    csrfToken,
    email,
    name,
    callbackUrl: "/app",
    json: "true",
  });
  const callbackRes = await fetchWithCookies(
    `${baseUrl}/api/auth/callback/dev-login?json=true`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "manual",
    },
    jar,
  );

  if (![200, 302].includes(callbackRes.status)) {
    fail(`dev-login callback failed with status ${callbackRes.status}`);
  }

  const sessionRes = await fetchWithCookies(`${baseUrl}/api/auth/session`, { method: "GET" }, jar);
  if (!sessionRes.ok) {
    fail(`Cannot read session after login (${sessionRes.status})`);
  }
  const session = await sessionRes.json();
  if (!session?.user?.email) {
    fail("Session does not contain a logged-in user after dev-login");
  }
  logStep("Auth", `Logged in as ${session.user.email}`);
}

function validateStripeJumpTarget(locationHeader, expectedHost) {
  let parsed;
  try {
    parsed = new URL(locationHeader);
  } catch {
    fail(`Redirect location is not a valid URL: ${locationHeader}`);
  }
  if (parsed.protocol !== "https:") {
    fail(`Stripe redirect must be HTTPS. Got: ${parsed.protocol}`);
  }
  if (expectedHost) {
    if (parsed.hostname !== expectedHost) {
      fail(`Stripe redirect host mismatch. expected=${expectedHost}, got=${parsed.hostname}`);
    }
    return;
  }
  if (!parsed.hostname.endsWith("stripe.com")) {
    fail(`Redirect host is not Stripe-like. Got: ${parsed.hostname}`);
  }
}

async function run() {
  const args = parseArgs(process.argv);
  const baseUrl = normalizeBaseUrl(args["base-url"] || process.env.STRIPE_REGRESSION_BASE_URL);
  const planId = (args.plan || process.env.STRIPE_REGRESSION_PLAN || "pro").trim();
  const cycleRaw = (args.cycle || process.env.STRIPE_REGRESSION_CYCLE || "yearly").trim().toLowerCase();
  const cycle = cycleRaw === "monthly" ? "monthly" : "yearly";
  const expectedHost = (args["expected-host"] || process.env.STRIPE_EXPECTED_HOST || "").trim();
  const authMode = (args.auth || process.env.STRIPE_REGRESSION_AUTH || "auto").trim();
  const cookieHeader = (args.cookie || process.env.STRIPE_REGRESSION_COOKIE || "").trim();
  const email = (args.email || process.env.STRIPE_REGRESSION_EMAIL || `qa+${Date.now()}@knowlens.ai`).trim();
  const name = (args.name || process.env.STRIPE_REGRESSION_NAME || "QA User").trim();
  const paidSessionId = (args["paid-session-id"] || process.env.STRIPE_REGRESSION_PAID_SESSION_ID || "").trim();

  logStep("Start", `base=${baseUrl}, plan=${planId}, cycle=${cycle}`);
  const jar = new CookieJar();

  if (cookieHeader) {
    jar.addCookieHeader(cookieHeader);
  }

  const providers = await ensureReachable(baseUrl, jar);
  const hasDevProvider = Boolean(providers?.["dev-login"]);
  const hasSessionCookie = Boolean(cookieHeader);

  if (authMode === "cookie" && !hasSessionCookie) {
    fail("auth=cookie requires --cookie or STRIPE_REGRESSION_COOKIE");
  }

  if (authMode === "dev" || (authMode === "auto" && hasDevProvider && !hasSessionCookie)) {
    await loginWithDevProvider(baseUrl, jar, email, name);
  } else if (hasSessionCookie) {
    logStep("Auth", "Using provided session cookie");
    const sessionRes = await fetchWithCookies(`${baseUrl}/api/auth/session`, { method: "GET" }, jar);
    if (!sessionRes.ok) {
      fail(`Session check failed (${sessionRes.status}) with provided cookie`);
    }
    const session = await sessionRes.json();
    if (!session?.user?.email) {
      fail("Provided cookie is not an authenticated session");
    }
    logStep("Auth", `Session user=${session.user.email}`);
  } else {
    fail(
      "No usable auth mode. Enable NEXTAUTH_ALLOW_DEV_LOGIN=true for regression or pass --cookie with a valid NextAuth session.",
    );
  }

  logStep("Checkout", "Calling /api/billing/checkout");
  const checkoutRes = await fetchWithCookies(
    `${baseUrl}/api/billing/checkout`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ planId, cycle }),
    },
    jar,
  );
  const checkoutData = await checkoutRes.json().catch(() => ({}));
  if (!checkoutRes.ok || !checkoutData?.ok || !checkoutData?.checkoutUrl) {
    fail(
      `Checkout API failed (${checkoutRes.status}). error=${checkoutData?.error || "unknown"} plan=${planId} cycle=${cycle}`,
    );
  }
  const checkoutUrl = new URL(checkoutData.checkoutUrl, baseUrl);
  if (!checkoutUrl.pathname.startsWith("/api/billing/redirect")) {
    fail(`checkoutUrl is not the expected redirect endpoint: ${checkoutUrl.toString()}`);
  }
  logStep("Checkout", `sessionId=${checkoutData.sessionId || "N/A"} mode=${checkoutData.mode || "unknown"}`);

  logStep("Redirect", "Verifying redirect endpoint jumps to Stripe");
  const redirectRes = await fetchWithCookies(
    checkoutUrl.toString(),
    {
      method: "GET",
      redirect: "manual",
    },
    jar,
  );
  if (![302, 303, 307, 308].includes(redirectRes.status)) {
    fail(`Redirect endpoint did not return redirect status. status=${redirectRes.status}`);
  }
  const location = redirectRes.headers.get("location") || "";
  if (!location) {
    fail("Redirect endpoint did not return a location header");
  }
  validateStripeJumpTarget(location, expectedHost);
  logStep("Redirect", `PASS -> ${location}`);

  logStep("Callback", "Verifying finalize endpoint behavior");
  if (paidSessionId) {
    const paidFinalizeRes = await fetchWithCookies(
      `${baseUrl}/api/billing/finalize`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionId: paidSessionId }),
      },
      jar,
    );
    const paidFinalize = await paidFinalizeRes.json().catch(() => ({}));
    if (!paidFinalizeRes.ok || !paidFinalize?.ok) {
      fail(
        `Paid finalize failed (${paidFinalizeRes.status}). error=${paidFinalize?.error || "unknown"}. Check session ownership/payment status.`,
      );
    }
    logStep("Callback", "PASS -> paid session finalized successfully");
  } else {
    const dryFinalizeRes = await fetchWithCookies(
      `${baseUrl}/api/billing/finalize`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionId: checkoutData.sessionId }),
      },
      jar,
    );
    const dryFinalize = await dryFinalizeRes.json().catch(() => ({}));
    if (!dryFinalizeRes.ok) {
      fail(
        `Finalize pre-check failed (${dryFinalizeRes.status}). error=${dryFinalize?.error || "unknown"}.`,
      );
    }
    if (dryFinalize?.ok === true) {
      logStep("Callback", "PASS -> finalize already succeeded (session completed)");
    } else {
      logStep(
        "Callback",
        `PASS (pre-payment) -> finalize reachable, current status=${dryFinalize?.status || "unknown"}, paymentStatus=${dryFinalize?.paymentStatus || "unknown"}`,
      );
    }
  }

  process.stdout.write("\n[Stripe Regression] ✅ All critical checks passed.\n");
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
