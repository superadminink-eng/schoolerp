import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const { oobCode, newPassword } = body;

    if (!oobCode || !newPassword) {
      return apiError("BAD_REQUEST", "Reset token and new password are required", 400);
    }

    // Sanitize token: only alphanumeric, underscore, and dash
    const tokenRegex = /^[a-zA-Z0-9\-_]+$/;
    if (!tokenRegex.test(oobCode)) {
      return apiError("INVALID_TOKEN", "Reset token is malformed.", 400);
    }

    // Validate Password Complexity Server-Side
    if (newPassword.length < 8 || newPassword.length > 128) {
      return apiError("VALIDATION_ERROR", "Password must be between 8 and 128 characters.", 400);
    }

    const passwordCriteria = [
      /[A-Z]/.test(newPassword), // uppercase
      /[a-z]/.test(newPassword), // lowercase
      /[0-9]/.test(newPassword), // number
      /[^A-Za-z0-9]/.test(newPassword), // symbol
    ];
    const metCount = passwordCriteria.filter(Boolean).length;
    if (metCount < 3) { // Requires at least 3 of 4 criteria
      return apiError("VALIDATION_ERROR", "Password does not meet complexity requirements.", 400);
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("[ResetConfirm] Firebase API Key is not configured in environment.");
      return apiError("INTERNAL_ERROR", "Auth service configuration error", 500);
    }

    // Call Firebase Auth REST API to confirm password reset
    const firebaseResetUrl = `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`;
    const resetRes = await fetch(firebaseResetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oobCode, newPassword }),
    });

    const resetData = await resetRes.json();
    if (!resetRes.ok || !resetData.email) {
      console.error("[ResetConfirm] Firebase password reset failed:", resetData.error?.message || "Unknown error");
      return apiError("INVALID_TOKEN", "Failed to reset password. The link may have expired or is invalid.", 400);
    }

    const { email } = resetData;

    // Retrieve all users matching the email
    const users = await prisma.user.findMany({
      where: { email },
    });

    if (users.length === 0) {
      return apiError("NOT_FOUND", "No user record found matching this email.", 404);
    }

    // Update matching user instances in MySQL transaction
    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            forcePasswordChange: false,
            tokenVersion: { increment: 1 },
          },
        });

        // Log audit event
        await logAction({
          organizationId: user.organizationId,
          branchId: user.branchId,
          userId: user.id,
          action: "UPDATE",
          module: "USERS",
          entityId: user.id,
          details: { context: "PASSWORD_RESET_CONFIRMED" },
        });
      }
    });

    return apiSuccess({
      success: true,
      email,
    });
  } catch (error) {
    console.error("[ResetConfirm] Error during password reset confirmation:", error);
    return apiError("INTERNAL_ERROR", "Failed to confirm password reset", 500);
  }
}
