import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

type RouteContext = any;

/**
 * POST /api/v1/admissions/applications/[id]/withdraw — Withdraw admission application
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "document_verification");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const { reason } = body as { reason: string };
  if (!reason || reason.trim() === "") {
    return apiError("BAD_REQUEST", "Withdrawal reason is required", 400);
  }

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

    if (application.status === "ADMITTED" || application.status === "REJECTED" || application.status === "WITHDRAWN") {
      return apiError("BAD_REQUEST", `Cannot withdraw application with status ${application.status}`, 400);
    }

    const updated = await prisma.admissionApplication.update({
      where: { id },
      data: {
        status: "WITHDRAWN",
        statusBeforeArchive: application.status,
        archiveReason: reason,
        verifiedAt: new Date(),
        verifiedById: ctx.userId || "system",
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
      details: { applicationNo: updated.applicationNo, status: "WITHDRAWN", reason, context: "WITHDRAW" }
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Withdraw applicant error:", error);
    return apiError("INTERNAL_ERROR", "Failed to withdraw applicant", 500);
  }
}
