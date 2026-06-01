import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config.
 * No Prisma, no Firebase Admin — only JWT callbacks and page config.
 * Used by middleware. The full config in auth.ts extends this.
 */
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.organizationId = user.organizationId;
        token.organizationSlug = user.organizationSlug;
        token.organizationName = user.organizationName;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
      }

      // Handle session.update() calls (e.g. branch switching)
      if (trigger === "update" && session) {
        if (session.branchId !== undefined) {
          token.branchId = session.branchId;
        }
        if (session.branchName !== undefined) {
          token.branchName = session.branchName;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.roleId = token.roleId as string;
      session.user.roleName = token.roleName as string;
      session.user.organizationId = token.organizationId as string;
      session.user.organizationSlug = token.organizationSlug as string;
      session.user.organizationName = token.organizationName as string;
      session.user.branchId = token.branchId as string | null;
      session.user.branchName = token.branchName as string | null;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = ["/login", "/register", "/forgot-password"].includes(
        nextUrl.pathname
      );

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      return isLoggedIn;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // Providers added in full auth.ts — not needed for Edge JWT checks
};
