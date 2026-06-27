import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe proxy (Next.js 16's renamed middleware): uses only the shared
// config (no DB/crypto imports). The `authorized` callback in auth.config.ts
// decides redirects.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except static assets and the Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
