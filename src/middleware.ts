import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const publicPaths = ["/", "/pricing"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public assets and API auth routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Public marketing pages — always accessible
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Auth redirects are handled by the `authorized` callback in auth.config.ts
  // If we reach here, the user is authenticated

  // Inject tenant context into headers for API routes
  const session = req.auth;

  if (session?.user) {
    const headers = new Headers(req.headers);
    headers.set("x-user-id", session.user.id);
    headers.set("x-user-role-id", session.user.roleId);
    headers.set("x-user-role-name", session.user.roleName);
    headers.set("x-organization-id", session.user.organizationId);
    headers.set("x-branch-id", session.user.branchId ?? "");

    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
