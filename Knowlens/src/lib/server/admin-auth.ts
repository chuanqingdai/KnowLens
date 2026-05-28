import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { resolveRoleByEmail } from "@/lib/auth";

export async function requireAdminEmail() {
  const session = await getServerSession(nextAuthOptions);
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email || resolveRoleByEmail(email) !== "admin") {
    return null;
  }
  return email;
}

