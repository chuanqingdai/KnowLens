export type UserRole = "user" | "admin";

export type AuthUser = {
  email: string;
  name: string;
  role: UserRole;
  provider: "google";
};

export const ADMIN_EMAIL = "chuanqingdai@gmail.com";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function resolveRoleByEmail(email: string): UserRole {
  return normalizeEmail(email) === ADMIN_EMAIL ? "admin" : "user";
}
