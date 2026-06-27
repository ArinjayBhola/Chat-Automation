import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "../auth.config";
import { upsertUserFromOAuth } from "./db-queries";

// Augment the session/jwt with our custom fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
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
      if (user && account?.provider === "google" && user.email) {
        // Prefer the DB user id; fall back to the Google account id.
        const dbUser = await upsertUserFromOAuth({
          googleId: account.providerAccountId,
          email: user.email,
          name: user.name,
          picture: user.image,
        });
        token.uid = dbUser?.id ?? account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid;
      }
      return session;
    },
  },
});

export const isGoogleAuthConfigured = googleConfigured;
