import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { logAction } from "@/lib/audit";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// Helper function to verify Cloudflare Turnstile Token
async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.warn("[ForgotPwd] CLOUDFLARE_TURNSTILE_SECRET_KEY is not configured. Bypassing Turnstile check.");
    return true;
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    });

    const data = await res.json();
    return !!data.success;
  } catch (error) {
    console.error("[ForgotPwd] Turnstile verification fetch failed:", error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Extract IP and User-Agent
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
                     req.headers.get("x-real-ip")?.trim() || 
                     "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Unknown";

    // 2. IP Rate Limit Check (10 requests per 10 minutes - Atomic Upsert)
    const window10m = Math.floor(Date.now() / (10 * 60 * 1000));
    const ipKey = `ip:${clientIp}:PASSWORD_RESET_IP:${window10m}`;
    const ipLimit = 10;

    const ipRateRecord = await prisma.rateLimit.upsert({
      where: { key: ipKey },
      update: { count: { increment: 1 } },
      create: {
        key: ipKey,
        count: 1,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // Expires in 10 minutes
      },
    });

    if (ipRateRecord.count > ipLimit) {
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
    const turnstileToken = body.turnstileToken;

    // Verify CAPTCHA if secret key is configured and request is not from an authenticated user session
    const isAuthenticated = !!req.headers.get("x-user-id");
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    if (secretKey && !isAuthenticated) {
      if (!turnstileToken) {
        return apiError("VALIDATION_ERROR", "Captcha verification is required.", 400);
      }
      const isHuman = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!isHuman) {
        return apiError("INVALID_CAPTCHA", "Captcha verification failed. Please try again.", 400);
      }
    }

    // 4. Find user in MySQL
    const user = await prisma.user.findFirst({
      where: { email: sanitizedEmail },
    });

    // 5. If user not found or inactive, return fake success (privacy protection)
    if (!user || !user.isActive) {
      console.log(`[ForgotPwd] Fake success response for nonexistent or inactive email: ${sanitizedEmail}`);
      return apiSuccess({ success: true });
    }

    // 6. Organization Quota Limit Check (50 requests per 1 hour - Atomic Upsert)
    const window1h = Math.floor(Date.now() / (60 * 60 * 1000));
    const orgKey = `org:${user.organizationId}:PASSWORD_RESET_ORG:${window1h}`;
    const orgLimit = 50;

    const orgRateRecord = await prisma.rateLimit.upsert({
      where: { key: orgKey },
      update: { count: { increment: 1 } },
      create: {
        key: orgKey,
        count: 1,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Expires in 1 hour
      },
    });

    if (orgRateRecord.count > orgLimit) {
      return apiError("TOO_MANY_REQUESTS", "School email quota reached. Please contact your administrator.", 429);
    }

    // 7. User Account Rate Limit Check (3 requests per 1 hour - Atomic Upsert)
    const userKey = `user:${user.id}:PASSWORD_RESET_USER:${window1h}`;
    const userLimit = 3;

    const userRateRecord = await prisma.rateLimit.upsert({
      where: { key: userKey },
      update: { count: { increment: 1 } },
      create: {
        key: userKey,
        count: 1,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Expires in 1 hour
      },
    });

    if (userRateRecord.count > userLimit) {
      return apiError("TOO_MANY_REQUESTS", "Too many reset links requested for this account. Please try again later.", 429);
    }

    // 8. Call Firebase Auth REST API to send password reset email
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

    // 9. Log the audit event
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

