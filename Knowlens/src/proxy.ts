import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth",
  },
});

export const config = {
  matcher: [
    "/app/:path*",
    "/workspace/:path*",
    "/projects/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
