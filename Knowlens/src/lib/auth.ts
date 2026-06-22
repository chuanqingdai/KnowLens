export type UserRole = "user" | "admin";

export type AuthUser = {
  email: string;
  name: string;
  role: UserRole;
  provider: "google" | "password";
};

export const ADMIN_EMAIL = "chuanqingdai@gmail.com";
export const LOCAL_ADMIN_EMAIL = "local@knowlens.ai";

const LOCAL_TEST_ADMIN_EMAIL_PATTERN = /^local(?:\+.*)?@knowlens\.ai$/;
const ADMIN_EMAIL_ALLOWLIST = (process.env.NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST ?? "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeEmailForRole(email: string) {
  return normalizeEmail(email).replace(/^password:/, "");
}

export function isAdminEmail(email: string) {
  const normalized = normalizeEmailForRole(email);
  if (normalized === ADMIN_EMAIL) {
    return true;
  }
  if (ADMIN_EMAIL_ALLOWLIST.includes(normalized)) {
    return true;
  }
  if (process.env.NODE_ENV !== "production" && LOCAL_TEST_ADMIN_EMAIL_PATTERN.test(normalized)) {
    return true;
  }
  if (process.env.NODE_ENV !== "production" && normalized === LOCAL_ADMIN_EMAIL) {
    return true;
  }
  return false;
}

export function resolveRoleByEmail(email: string): UserRole {
  return isAdminEmail(email) ? "admin" : "user";
}
