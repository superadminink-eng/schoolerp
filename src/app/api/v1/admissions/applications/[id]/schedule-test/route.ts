import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

type RouteContext = any;

/**
 * POST /api/v1/admissions/applications/[id]/schedule-test — Schedule entrance test & log results
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "admissions", "entrance_exam");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const { examDate, maxMarks, marksObtained, verdict, notes, applicationStatus, archiveReason } = body as {
    examDate: string;
    maxMarks: number;
    marksObtained?: number;
    verdict: "PENDING" | "PASS" | "FAIL" | "BORDERLINE";
    notes?: string;
    applicationStatus?: "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
    archiveReason?: string;
  };

  if (!examDate || maxMarks === undefined || !verdict) {
    return apiError("BAD_REQUEST", "Missing required fields (examDate, maxMarks, verdict)", 400);
  }

  if (marksObtained !== undefined && (marksObtained > maxMarks || marksObtained < 0)) {
    return apiError("BAD_REQUEST", "Marks obtained must be between 0 and maxMarks", 400);
  }

  try {
    // 1. Verify application exists and belongs to organization/branch scope
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
      const dataToUpdate: Record<string, any> = { status: nextStatus };
      if (nextStatus === "REJECTED") {
        dataToUpdate.statusBeforeArchive = application.status;
        dataToUpdate.archiveReason = archiveReason || null;
      }
      
      const app = await tx.admissionApplication.update({
        where: { id },
        data: dataToUpdate,
        include: {
          documents: true,
          examResult: true,
          class: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      });

      return app;
    }, { timeout: 15000 });

    await logAction({
      organizationId: ctx.organizationId,
      branchId: result.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ADMISSIONS",
      entityId: result.id,
      details: { applicationNo: result.applicationNo, verdict, marksObtained, maxMarks, context: "SCHEDULE_TEST" }
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("Schedule test error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update test details", 500);
  }
}
