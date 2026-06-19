import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getAdminAuth } from "./firebase-admin";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

/**
 * Full auth config — extends the Edge-safe base config with
 * providers that require Node.js APIs (Prisma, Firebase Admin).
 * Used by API routes and server components. NOT used by middleware.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // 1. Run base jwt callback to populate initial fields
      let baseToken = token;
      if (authConfig.callbacks?.jwt) {
        const result = await authConfig.callbacks.jwt({ token, user, trigger, session });
        if (result) {
          baseToken = result;
        }
      }

      // 2. Perform dynamic database-level session check
      if (baseToken?.userId) {
        const now = Date.now();
        try {
          const lastChecked = (baseToken.lastChecked as number) || 0;

          // Perform check every 60 seconds or on trigger === "update"
          if (now - lastChecked > 60 * 1000 || trigger === "update") {
            const dbUser = await prisma.user.findUnique({
              where: { id: baseToken.userId as string },
              select: {
                tokenVersion: true,
                isActive: true,
                forcePasswordChange: true,
                roleId: true,
                role: { select: { name: true } },
                branchId: true,
                branch: { select: { name: true } },
                organization: { select: { isActive: true } }
              },
            });

            // Invalidate session if user doesn't exist, is deactivated, organization is deactivated, or token version mismatch
            const tokenVersion = (baseToken.tokenVersion as number) ?? 1;
            if (!dbUser || !dbUser.isActive || !dbUser.organization?.isActive || dbUser.tokenVersion !== tokenVersion) {
              console.warn(
                `[AuthJWT] Invalidation triggered for user ${baseToken.userId}. ` +
                `Exists: ${!!dbUser}, Active: ${dbUser?.isActive}, Org Active: ${dbUser?.organization?.isActive}, ` +
                `DB Version: ${dbUser?.tokenVersion}, Token Version: ${tokenVersion}`
              );
              return {
                ...baseToken,
                error: "SessionInvalid",
              };
            }

            // Sync other live profile changes ONLY if we are not processing a client-side update trigger
            // This prevents database lookups from overwriting explicit session updates (e.g. branch switching)
            if (trigger !== "update") {
              if (dbUser.forcePasswordChange !== baseToken.forcePasswordChange) {
                baseToken.forcePasswordChange = dbUser.forcePasswordChange;
              }
              if (dbUser.roleId !== baseToken.roleId) {
                baseToken.roleId = dbUser.roleId;
                baseToken.roleName = dbUser.role.name;
              }
              if (dbUser.branchId !== baseToken.branchId) {
                baseToken.branchId = dbUser.branchId;
                baseToken.branchName = dbUser.branch?.name ?? null;
              }
            }

            // Update checked throttle
            baseToken.lastChecked = now;
          }
        } catch (error) {
          // Outage Resilience: Fail-open but retry check in 10 seconds
          console.error("[AuthJWT] Dynamic database session check failed (Outage Resilience):", error);
          baseToken.lastChecked = now - 50 * 1000;
        }
      }

      return baseToken;
    },
    async session(params) {
      if (params.token.error === "SessionInvalid") {
        return null as any;
      }
      if (authConfig.callbacks?.session) {
        return authConfig.callbacks.session(params as any);
      }
      return params.session;
    },
  },
  providers: [
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: {
        idToken: { type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        try {
          const adminAuth = getAdminAuth();
          const decoded = await adminAuth.verifyIdToken(
            credentials.idToken as string
          );

          const user = await prisma.user.findUnique({
            where: { firebaseUid: decoded.uid },
            include: {
              organization: { select: { id: true, slug: true, name: true, logo: true, isActive: true, isSetupComplete: true } },
              branch: { select: { id: true, name: true, code: true } },
              role: { select: { id: true, name: true } },
            },
          });

          if (!user || !user.isActive || !user.organization.isActive) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar,
            roleId: user.role.id,
            roleName: user.role.name,
            organizationId: user.organizationId,
            organizationSlug: user.organization.slug,
            organizationName: user.organization.name,
            organizationLogo: user.organization.logo,
            branchId: user.branchId,
            branchName: user.branch?.name ?? null,
            forcePasswordChange: user.forcePasswordChange,
            tokenVersion: user.tokenVersion,
            organizationIsSetupComplete: user.organization.isSetupComplete,
          };
        } catch (error) {
          console.error("Firebase token verification failed:", error);
          return null;
        }
      },
    }),
  ],
});
