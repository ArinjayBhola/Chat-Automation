import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config shared between middleware and the full server
 * config. Must NOT import Node-only modules (db driver, crypto helpers) so it
 * can run in the Edge middleware runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  // Providers are added in auth.ts; middleware only needs callbacks/pages.
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = nextUrl.pathname.startsWith("/auth");
      const isPublicAsset =
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname === "/api/register" ||
        nextUrl.pathname === "/favicon.ico" ||
        nextUrl.pathname === "/icon.svg";

      if (isPublicAsset) return true;
      if (isAuthPage) {
        // Logged-in users shouldn't sit on the sign-in page.
        if (isLoggedIn) {
          return Response.redirect(new URL("/chat", nextUrl));
        }
        return true;
      }
      // Everything else requires a session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
