type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitConfigMap = {
  billingCheckout: RateLimitConfig;
  uploadJobCreate: RateLimitConfig;
  feedbackCreate: RateLimitConfig;
  feedbackReply: RateLimitConfig;
  featuredLike: RateLimitConfig;
  featuredView: RateLimitConfig;
  contentPosterDraft: RateLimitConfig;
  authGoogleOneTapVerify: RateLimitConfig;
  appStartGenerate: RateLimitConfig;
  workspaceChatInput: RateLimitConfig;
};

function parseIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function toWindowMs(seconds: number) {
  return seconds * 1000;
}

export const RATE_LIMIT_CONFIG: RateLimitConfigMap = {
  billingCheckout: {
    limit: parseIntEnv("RATE_LIMIT_BILLING_CHECKOUT_LIMIT", 6),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_BILLING_CHECKOUT_WINDOW_SECONDS", 600)),
  },
  uploadJobCreate: {
    limit: parseIntEnv("RATE_LIMIT_UPLOAD_JOB_CREATE_LIMIT", 12),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_UPLOAD_JOB_CREATE_WINDOW_SECONDS", 60)),
  },
  feedbackCreate: {
    limit: parseIntEnv("RATE_LIMIT_FEEDBACK_CREATE_LIMIT", 4),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_FEEDBACK_CREATE_WINDOW_SECONDS", 600)),
  },
  feedbackReply: {
    limit: parseIntEnv("RATE_LIMIT_FEEDBACK_REPLY_LIMIT", 20),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_FEEDBACK_REPLY_WINDOW_SECONDS", 600)),
  },
  featuredLike: {
    limit: parseIntEnv("RATE_LIMIT_FEATURED_LIKE_LIMIT", 30),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_FEATURED_LIKE_WINDOW_SECONDS", 60)),
  },
  featuredView: {
    limit: parseIntEnv("RATE_LIMIT_FEATURED_VIEW_LIMIT", 90),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_FEATURED_VIEW_WINDOW_SECONDS", 60)),
  },
  contentPosterDraft: {
    limit: parseIntEnv("RATE_LIMIT_CONTENT_POSTER_DRAFT_LIMIT", 20),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_CONTENT_POSTER_DRAFT_WINDOW_SECONDS", 300)),
  },
  authGoogleOneTapVerify: {
    limit: parseIntEnv("RATE_LIMIT_AUTH_GOOGLE_ONETAP_VERIFY_LIMIT", 20),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_AUTH_GOOGLE_ONETAP_VERIFY_WINDOW_SECONDS", 300)),
  },
  appStartGenerate: {
    limit: parseIntEnv("RATE_LIMIT_APP_START_GENERATE_LIMIT", 24),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_APP_START_GENERATE_WINDOW_SECONDS", 600)),
  },
  workspaceChatInput: {
    limit: parseIntEnv("RATE_LIMIT_WORKSPACE_CHAT_INPUT_LIMIT", 120),
    windowMs: toWindowMs(parseIntEnv("RATE_LIMIT_WORKSPACE_CHAT_INPUT_WINDOW_SECONDS", 3600)),
  },
};
