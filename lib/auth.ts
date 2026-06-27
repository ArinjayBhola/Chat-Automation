import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "../auth.config";
import { upsertUserFromOAuth } from "./db-queries";

// Augment the session/jwt with our custom fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isDemo: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    isDemo?: boolean;
  }
}

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // `trustHost` lets Auth.js work behind Vercel/proxies without NEXTAUTH_URL.
  trustHost: true,
  providers: [
    // Google login + (later) tool scopes. Only registered when configured so
    // demo mode works with zero credentials.
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
    // Demo provider: one-click sign-in, no external services.
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize() {
        return {
          id: "demo-user",
          name: "Demo User",
          email: "demo@relay.app",
          image: `https://api.dicebear.com/9.x/initials/svg?seed=Demo%20User`,
          isDemo: true,
        } as unknown as { id: string };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Persist real (non-demo) users when a database is configured.
      if (account?.provider === "google" && user.email) {
        await upsertUserFromOAuth({
          googleId: account.providerAccountId,
          email: user.email,
          name: user.name,
          picture: user.image,
        });
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.isDemo = (user as { isDemo?: boolean }).isDemo ?? false;
        // Prefer the DB user id when available; fall back to provider id.
        if (account?.provider === "google" && user.email) {
          const dbUser = await upsertUserFromOAuth({
            googleId: account.providerAccountId,
            email: user.email,
            name: user.name,
            picture: user.image,
          });
          token.uid = dbUser?.id ?? account.providerAccountId;
        } else {
          token.uid = user.id ?? "demo-user";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? "demo-user";
        session.user.isDemo = token.isDemo ?? false;
      }
      return session;
    },
  },
});

export const isGoogleAuthConfigured = googleConfigured;
