import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createFollowUpSchema } from "@/lib/validations/admission";
import { logAction } from "@/lib/audit";

type RouteContext = any;

/**
 * POST /api/v1/admissions/inquiries/[id]/follow-ups — Log a follow-up conversation
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "inquiry_desk");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createFollowUpSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  try {
    // 1. Verify inquiry exists and belongs to organization/branch scope
    const inquiry = await prisma.admissionInquiry.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...(ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!inquiry) {
      return apiError("NOT_FOUND", "Inquiry not found in current scope", 404);
    }

    // 2. Perform transaction to create follow-up and update status
    const followUp = await prisma.$transaction(async (tx) => {
      // Create follow-up log
      const log = await tx.inquiryFollowUp.create({
        data: {
          inquiryId: id,
          counselorId: ctx.userId || "system",
          conversationNotes: data.conversationNotes,
          nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null,
          statusReached: data.statusReached,
        },
      });

      // Update inquiry status
      await tx.admissionInquiry.update({
        where: { id },
        data: { status: data.statusReached },
      });

      return log;
    }, { timeout: 10000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: inquiry.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ADMISSIONS",
      entityId: inquiry.id,
      details: { studentName: inquiry.studentName, statusReached: data.statusReached, context: "INQUIRY_FOLLOW_UP" }
    });

    return apiSuccess(followUp, undefined, 201);
  } catch (error) {
    console.error("Create follow-up error:", error);
    return apiError("INTERNAL_ERROR", "Failed to log follow-up", 500);
  }
}
