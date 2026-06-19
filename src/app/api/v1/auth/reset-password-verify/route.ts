import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const oobCode = url.searchParams.get("oobCode");

    if (!oobCode) {
      return apiError("BAD_REQUEST", "Reset token is required", 400);
    }

    // Sanitize token: only alphanumeric, underscore, and dash
    const tokenRegex = /^[a-zA-Z0-9\-_]+$/;
    if (!tokenRegex.test(oobCode)) {
      return apiError("INVALID_TOKEN", "Reset token is malformed.", 400);
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("[ResetVerify] Firebase API Key is not configured in environment.");
      return apiError("INTERNAL_ERROR", "Auth service configuration error", 500);
    }

    // Call Firebase Auth REST API verifyPasswordResetCode (using resetPassword endpoint with only oobCode)
    const firebaseVerifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`;
    const verifyRes = await fetch(firebaseVerifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oobCode }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.email) {
      console.error("[ResetVerify] Firebase code verification failed:", verifyData.error?.message || "Unknown error");
      return apiError("INVALID_TOKEN", "The reset link is invalid or has expired.", 400);
    }

    const { email } = verifyData;

    // Check if user is active in MySQL
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      return apiError("NOT_FOUND", "No user found associated with this reset link.", 404);
    }

    if (!user.isActive) {
      return apiError("FORBIDDEN", "This account has been disabled or suspended.", 403);
    }

    return apiSuccess({
      email,
    });
  } catch (error) {
    console.error("[ResetVerify] Error during token verification:", error);
    return apiError("INTERNAL_ERROR", "Failed to verify reset token", 500);
  }
}
