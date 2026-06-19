import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { logAction } from "@/lib/audit";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Extract IP and User-Agent
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                     req.headers.get("x-real-ip")?.trim() || 
                     "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Unknown";

    // 2. IP Rate Limit Check (Last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const ipRequests = await prisma.auditLog.count({
      where: {
        action: "CREATE",
        module: "AUTH",
        createdAt: { gte: tenMinutesAgo },
        AND: [
          { details: { contains: `"context":"PASSWORD_RESET_REQUEST"` } },
          { details: { contains: `"ip":"${clientIp}"` } }
        ]
      },
    });

    if (ipRequests >= 10) {
      return apiError("TOO_MANY_REQUESTS", "Too many requests from this device. Please try again later.", 429);
    }

    // 3. Parse and validate body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0].message, 400);
    }

    const sanitizedEmail = parsed.data.email.toLowerCase().trim();

    // 4. Find user in MySQL
    const user = await prisma.user.findFirst({
      where: { email: sanitizedEmail },
    });

    // 5. If user not found or inactive, return fake success (privacy protection)
    if (!user || !user.isActive) {
      console.log(`[ForgotPwd] Fake success response for nonexistent or inactive email: ${sanitizedEmail}`);
      return apiSuccess({ success: true });
    }

    // 6. User Account Rate Limit Check (Last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const userRequests = await prisma.auditLog.count({
      where: {
        userId: user.id,
        action: "CREATE",
        module: "AUTH",
        createdAt: { gte: oneHourAgo },
        details: { contains: `"context":"PASSWORD_RESET_REQUEST"` },
      },
    });

    if (userRequests >= 3) {
      return apiError("TOO_MANY_REQUESTS", "Too many reset links requested for this account. Please try again later.", 429);
    }

    // 7. Call Firebase Auth REST API to send password reset email
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("[ForgotPwd] Firebase API Key is not configured in environment.");
      return apiError("INTERNAL_ERROR", "Auth service configuration error", 500);
    }

    const firebaseResetUrl = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
    const firebaseRes = await fetch(firebaseResetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email: sanitizedEmail,
      }),
    });

    const firebaseData = await firebaseRes.json();
    if (!firebaseRes.ok) {
      console.error("[ForgotPwd] Firebase REST error:", firebaseData.error?.message || "Unknown error");
      if (firebaseData.error?.message === "TOO_MANY_ATTEMPTS_TRY_LATER") {
        return apiError("TOO_MANY_REQUESTS", "Too many requests. Please try again later.", 429);
      }
      return apiError("INTERNAL_ERROR", "Failed to process password recovery", 500);
    }

    // 8. Log the audit event
    await logAction({
      organizationId: user.organizationId,
      branchId: user.branchId,
      userId: user.id,
      action: "CREATE",
      module: "AUTH",
      entityId: user.id,
      details: {
        context: "PASSWORD_RESET_REQUEST",
        ip: clientIp,
        userAgent,
      },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("[ForgotPwd] Error in forgot password route:", error);
    return apiError("INTERNAL_ERROR", "Failed to process request", 500);
  }
}
