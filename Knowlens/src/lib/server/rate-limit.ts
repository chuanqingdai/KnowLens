import { enforceRateLimit } from "./store";

export async function rateLimitOrThrow(input: {
  scopeKey: string;
  endpoint: string;
  limit: number;
  windowMs: number;
}) {
  const result = await enforceRateLimit(input);
  if (result.allowed) {
    return result;
  }
  const error = new Error("Rate limit exceeded");
  (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = result.retryAfterSeconds;
  throw error;
}
