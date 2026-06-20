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

  // Instantiate new headers to sanitize incoming request headers
  const headers = new Headers(req.headers);

  // CRITICAL: Always strip any client-provided x-user or x-organization context headers to prevent header spoofing
  headers.delete("x-user-id");
  headers.delete("x-user-role-id");
  headers.delete("x-user-role-name");
  headers.delete("x-organization-id");
  headers.delete("x-branch-id");

  const session = req.auth;

  if (session?.user) {
    // 1. Intercept user if password change is forced
    if (
      session.user.forcePasswordChange &&
      pathname !== "/force-password-change" &&
      !pathname.startsWith("/api")
    ) {
      return NextResponse.redirect(new URL("/force-password-change", req.nextUrl));
    }

    // 2. Intercept user if organization setup is incomplete
    if (
      !session.user.organizationIsSetupComplete &&
      pathname !== "/onboarding" &&
      pathname !== "/onboarding/pending" &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/_next") &&
      pathname !== "/favicon.ico"
    ) {
      if (session.user.roleName === "SCHOOL_ADMIN") {
        return NextResponse.redirect(new URL("/onboarding", req.nextUrl));
      } else {
        return NextResponse.redirect(new URL("/onboarding/pending", req.nextUrl));
      }
    }

    // 3. Prevent onboarded users from revisiting onboarding pages
    if (
      session.user.organizationIsSetupComplete &&
      (pathname === "/onboarding" || pathname === "/onboarding/pending")
    ) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }

    headers.set("x-user-id", session.user.id);
    headers.set("x-user-role-id", session.user.roleId);
    headers.set("x-user-role-name", session.user.roleName);
    headers.set("x-organization-id", session.user.organizationId);
    headers.set("x-branch-id", session.user.branchId ?? "");
    headers.set("x-token-version", String(session.user.tokenVersion));

    return NextResponse.next({ request: { headers } });
  }

  const publicApiPaths = [
    "/api/v1/parent/auth/login",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password-verify",
    "/api/v1/auth/reset-password-confirm",
    "/api/v1/organizations/register",
  ];

  // If no session exists, return 401 for private API routes (except parent login and bearer-token authenticated endpoints)
  if (
    pathname.startsWith("/api/v1/") &&
    !publicApiPaths.includes(pathname) &&
    !req.headers.get("authorization")?.trim().startsWith("Bearer ")
  ) {
    return new NextResponse(
      JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // If no session exists, forward request with sanitized (stripped) headers
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
