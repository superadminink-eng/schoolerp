import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import crypto from "crypto";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/v1/admissions/applications/[id]/generate-upload-link
 * Generates a 7-day secure magic upload token for parents to upload documents via mobile.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "document_verification");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  try {
    // 1. Scope check
    const application = await prisma.admissionApplication.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...(ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
          ? { branchId: ctx.branchId }
          : {}),
      },
      include: {
        class: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });

    if (!application) {
      return apiError("NOT_FOUND", "Application not found in current scope", 404);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const forceRenew = !!body.forceRenew;

    // 2. Check for active existing token unless forceRenew requested
    let tokenRecord = null;

    if (!forceRenew) {
      tokenRecord = await prisma.applicationToken.findFirst({
        where: {
          applicationId: id,
          expiresAt: { gt: new Date() },
          isConsumed: false,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!tokenRecord) {
      // Invalidate any old tokens for this application
      await prisma.applicationToken.updateMany({
        where: { applicationId: id, isConsumed: false },
        data: { isConsumed: true },
      });

      const newTokenStr = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      tokenRecord = await prisma.applicationToken.create({
        data: {
          applicationId: id,
          token: newTokenStr,
          expiresAt,
        },
      });
    }

    // 3. Construct Magic URL
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = `${protocol}://${host}`;
    const magicUrl = `${origin}/public/upload-docs/${tokenRecord.token}`;

    // 4. Construct WhatsApp Message & Link
    const parentPhone = application.fatherPhone || application.motherPhone || "";
    let cleanPhone = parentPhone.replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const studentName = `${application.firstName} ${application.lastName}`.trim();
    const branchName = application.branch?.name || "School";
    const className = application.class?.name || "";

    const messageText = `Namaste! Please click this secure link to upload missing admission documents for *${studentName}* (${className}) [App No: ${application.applicationNo}]:\n\n👉 ${magicUrl}\n\nThank you,\n*${branchName} Admissions Desk*`;

    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    return apiSuccess({
      token: tokenRecord.token,
      expiresAt: tokenRecord.expiresAt,
      magicUrl,
      whatsappUrl,
      parentPhone,
      studentName,
    });
  } catch (error: any) {
    console.error("Generate upload link error:", error);
    return apiError("INTERNAL_ERROR", error.message || "Failed to generate upload link", 500);
  }
}
