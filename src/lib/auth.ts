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
              organization: { select: { id: true, slug: true, name: true, isActive: true } },
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
            branchId: user.branchId,
            branchName: user.branch?.name ?? null,
          };
        } catch (error) {
          console.error("Firebase token verification failed:", error);
          return null;
        }
      },
    }),
  ],
});
