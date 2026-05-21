export type UserRole = "user" | "admin";

export type AuthUser = {
  email: string;
  name: string;
  role: UserRole;
  provider: "google";
};

export const ADMIN_EMAIL = "chuanqingdai@gmail.com";
export const AUTH_STORAGE_KEY = "scilens_auth_user_v1";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function resolveRoleByEmail(email: string): UserRole {
  return normalizeEmail(email) === ADMIN_EMAIL ? "admin" : "user";
}

export function getStoredAuthUser() {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}
