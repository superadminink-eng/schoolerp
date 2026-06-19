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
        token.organizationLogo = user.organizationLogo;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
        token.forcePasswordChange = user.forcePasswordChange;
        token.tokenVersion = user.tokenVersion;
        token.organizationIsSetupComplete = user.organizationIsSetupComplete;
      }
 
      // Handle session.update() calls (e.g. branch switching, password resets, onboarding complete)
      if (trigger === "update" && session) {
        if (session.branchId !== undefined) {
          token.branchId = session.branchId;
        }
        if (session.branchName !== undefined) {
          token.branchName = session.branchName;
        }
        if (session.forcePasswordChange !== undefined) {
          token.forcePasswordChange = session.forcePasswordChange;
        }
        if (session.tokenVersion !== undefined) {
          token.tokenVersion = session.tokenVersion;
        }
        if (session.organizationIsSetupComplete !== undefined) {
          token.organizationIsSetupComplete = session.organizationIsSetupComplete;
        }
        if (session.organizationLogo !== undefined) {
          token.organizationLogo = session.organizationLogo;
        }
      }
 
      return token;
    },
    async session({ session, token }) {
      if (token.error === "SessionInvalid") {
        return null as any;
      }
      session.user.id = token.userId as string;
      session.user.roleId = token.roleId as string;
      session.user.roleName = token.roleName as string;
      session.user.organizationId = token.organizationId as string;
      session.user.organizationSlug = token.organizationSlug as string;
      session.user.organizationName = token.organizationName as string;
      session.user.organizationLogo = (token.organizationLogo as string | null) ?? null;
      session.user.branchId = token.branchId as string | null;
      session.user.branchName = token.branchName as string | null;
      session.user.forcePasswordChange = (token.forcePasswordChange as boolean) ?? false;
      session.user.tokenVersion = (token.tokenVersion as number) ?? 1;
      session.user.organizationIsSetupComplete = (token.organizationIsSetupComplete as boolean) ?? false;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user && (auth as any)?.error !== "SessionInvalid";
      const { pathname } = nextUrl;

      // Bypass auth checks for Next.js internal paths, APIs, assets, and public marketing pages
      if (
        pathname.startsWith("/_") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/assets") ||
        pathname === "/favicon.ico" ||
        pathname === "/" ||
        pathname === "/pricing"
      ) {
        return true;
      }

      const isAuthPage = [
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
      ].includes(pathname);

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
