import { enforceRateLimit } from "./store";

export function rateLimitOrThrow(input: {
  scopeKey: string;
  endpoint: string;
  limit: number;
  windowMs: number;
}) {
  const result = enforceRateLimit(input);
  if (result.allowed) {
    return result;
  }
  const error = new Error("Rate limit exceeded");
  (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = result.retryAfterSeconds;
  throw error;
}

