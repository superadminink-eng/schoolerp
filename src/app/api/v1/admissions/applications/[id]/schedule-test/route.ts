import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admissions/applications/[id]/schedule-test — Schedule entrance test & log results
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const { examDate, maxMarks, marksObtained, verdict, notes, applicationStatus } = body as {
    examDate: string;
    maxMarks: number;
    marksObtained?: number;
    verdict: "PENDING" | "PASS" | "FAIL" | "BORDERLINE";
    notes?: string;
    applicationStatus?: "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
  };

  if (!examDate || maxMarks === undefined || !verdict) {
    return apiError("BAD_REQUEST", "Missing required fields (examDate, maxMarks, verdict)", 400);
  }

  try {
    // 1. Verify application exists and belongs to organization/branch scope
    const application = await prisma.admissionApplication.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!application) {
      return apiError("NOT_FOUND", "Application not found in current scope", 404);
    }

    // 2. Perform updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Upsert EntranceExamResult
      const examResult = await tx.entranceExamResult.upsert({
        where: { applicationId: id },
        update: {
          examDate: new Date(examDate),
          maxMarks,
          marksObtained: marksObtained !== undefined ? marksObtained : null,
          verdict,
          notes: notes || null,
        },
        create: {
          applicationId: id,
          examDate: new Date(examDate),
          maxMarks,
          marksObtained: marksObtained !== undefined ? marksObtained : null,
          verdict,
          notes: notes || null,
          scheduledBy: ctx.userId || "system",
        },
      });

      // Update application status
      const nextStatus = applicationStatus || (verdict === "PASS" ? "SHORTLISTED" : "TEST_SCHEDULED");
      
      const app = await tx.admissionApplication.update({
        where: { id },
        data: { status: nextStatus },
        include: { documents: true, examResult: true },
      });

      return app;
    }, { timeout: 15000 });

    return apiSuccess(result);
  } catch (error) {
    console.error("Schedule test error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update test details", 500);
  }
}
