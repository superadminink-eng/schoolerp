import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

type RouteContext = any;

/**
 * POST /api/v1/admissions/applications/[id]/reactivate — Reactivate archived application
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "document_verification");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  try {
    const application = await prisma.admissionApplication.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...(ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!application) {
      return apiError("NOT_FOUND", "Application not found in current scope", 404);
    }

    if (application.status !== "REJECTED" && application.status !== "WITHDRAWN") {
      return apiError("BAD_REQUEST", `Application is not archived (status is ${application.status})`, 400);
    }

    // Determine stage to restore to (fallback to DOCUMENT_VERIFICATION)
    const restoreStatus = (application.statusBeforeArchive as any) || "DOCUMENT_VERIFICATION";

    const updated = await prisma.admissionApplication.update({
      where: { id },
      data: {
        status: restoreStatus,
        statusBeforeArchive: null,
        archiveReason: null,
      },
      include: {
        documents: true,
        examResult: true,
        class: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: updated.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ADMISSIONS",
      entityId: updated.id,
      details: { applicationNo: updated.applicationNo, status: restoreStatus, context: "REACTIVATE" }
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Reactivate applicant error:", error);
    return apiError("INTERNAL_ERROR", "Failed to reactivate applicant", 500);
  }
}
