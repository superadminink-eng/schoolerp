import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { logAction } from "@/lib/audit";

async function verifyCurrentPassword(email: string, password?: string): Promise<boolean> {
  if (!password) return false;
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_FIREBASE_API_KEY is not defined.");
      return false;
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    return res.ok;
  } catch (error) {
    console.error("Firebase auth REST API error during password verification:", error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", "Not authenticated", 401);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return apiError("BAD_REQUEST", "New password is required", 400);
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
    if (metCount < 3) {
      return apiError("VALIDATION_ERROR", "Password does not meet complexity requirements.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return apiNotFound("User");
    }

    const adminAuth = getAdminAuth();

    // Fetch all user records matching the email to sync changes across all profiles
    const users = await prisma.user.findMany({
      where: { email: user.email },
    });

    // Case 1: Forced Password Change (User is changing password on first login after admin reset)
    if (user.forcePasswordChange) {
      // 1. Update Firebase Auth Password
      try {
        await adminAuth.updateUser(user.firebaseUid, { password: newPassword });
      } catch (fbErr: any) {
        console.error("[ChangePwd] Firebase update user error:", fbErr);
        return apiError("INTERNAL_ERROR", "Failed to update authentication server password.", 500);
      }

      // 2. Sync all database user records with this email
      let currentUpdatedVersion = user.tokenVersion + 1;
      await prisma.$transaction(async (tx) => {
        for (const u of users) {
          const updated = await tx.user.update({
            where: { id: u.id },
            data: {
              forcePasswordChange: false,
              tokenVersion: { increment: 1 },
            },
          });
          if (u.id === user.id) {
            currentUpdatedVersion = updated.tokenVersion;
          }
          await logAction({
            organizationId: u.organizationId,
            branchId: u.branchId,
            userId: u.id,
            action: "UPDATE",
            module: "USERS",
            entityId: u.id,
            details: { context: "PASSWORD_CHANGE_FORCED_SYNC" },
          });
        }
      });

      return apiSuccess({
        success: true,
        tokenVersion: currentUpdatedVersion,
      });
    }

    // Case 2: Self-Service Password Change (User changes password from profile page)
    if (!currentPassword) {
      return apiError("BAD_REQUEST", "Current password is required to change password", 400);
    }

    // Similarity Check: New password must be different
    if (currentPassword === newPassword) {
      return apiError("VALIDATION_ERROR", "New password must be different from current password.", 400);
    }

    // 1. Verify current credentials against Firebase
    const verified = await verifyCurrentPassword(user.email, currentPassword);
    if (!verified) {
      return apiError("UNAUTHORIZED", "Incorrect current password.", 401);
    }

    // 2. Update Firebase Auth Password using Admin SDK
    try {
      await adminAuth.updateUser(user.firebaseUid, { password: newPassword });
    } catch (fbErr: any) {
      console.error("[ChangePwd] Firebase update user error:", fbErr);
      return apiError("INTERNAL_ERROR", "Failed to update authentication server password.", 500);
    }

    // 3. Invalidate active sessions by incrementing tokenVersion for all users with this email
    let currentUpdatedVersion = user.tokenVersion + 1;
    await prisma.$transaction(async (tx) => {
      for (const u of users) {
        const updated = await tx.user.update({
          where: { id: u.id },
          data: {
            tokenVersion: { increment: 1 },
          },
        });
        if (u.id === user.id) {
          currentUpdatedVersion = updated.tokenVersion;
        }
        await logAction({
          organizationId: u.organizationId,
          branchId: u.branchId,
          userId: u.id,
          action: "UPDATE",
          module: "USERS",
          entityId: u.id,
          details: { context: "PASSWORD_CHANGE_PROFILE_SYNC" },
        });
      }
    });

    return apiSuccess({
      success: true,
      tokenVersion: currentUpdatedVersion,
    });
  } catch (error) {
    console.error("Profile change-password API error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update user security record", 500);
  }
}
