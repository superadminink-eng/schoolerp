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
 * POST /api/v1/admissions/applications/[id]/verify — Verify uploaded documents
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

  const { documents, applicationStatus, verificationNotes, archiveReason } = body as {
    documents?: { id: string; status: "PENDING" | "VERIFIED" | "REJECTED"; remarks?: string }[];
    applicationStatus?: "DOCUMENT_VERIFICATION" | "SHORTLISTED" | "REJECTED" | "TEST_SCHEDULED";
    verificationNotes?: string;
    archiveReason?: string;
  };

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
    const updated = await prisma.$transaction(async (tx) => {
      // Update individual documents if provided
      if (documents && documents.length > 0) {
        for (const doc of documents) {
          if (doc.id.startsWith("mock-")) continue;
          await tx.applicationDocument.update({
            where: { id: doc.id, applicationId: id },
            data: {
              status: doc.status,
              remarks: doc.remarks || null,
            },
          });
        }
      }

      // Update application fields (status, verificationNotes)
      const dataToUpdate: Record<string, any> = {};
      if (applicationStatus) {
        dataToUpdate.status = applicationStatus;
        if (applicationStatus === "REJECTED") {
          dataToUpdate.statusBeforeArchive = application.status;
          dataToUpdate.archiveReason = archiveReason || null;
        }
      }
      if (verificationNotes !== undefined) {
        dataToUpdate.verificationNotes = verificationNotes;
      }

      if (Object.keys(dataToUpdate).length > 0) {
        dataToUpdate.verifiedAt = new Date();
        dataToUpdate.verifiedById = ctx.userId || "system";
        
        return tx.admissionApplication.update({
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
      }

      return tx.admissionApplication.findUnique({
        where: { id },
        include: {
          documents: true,
          examResult: true,
          class: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      });
    }, { timeout: 15000 });

    if (!updated) {
      return apiError("NOT_FOUND", "Application not found after update", 404);
    }

    await logAction({
      organizationId: ctx.organizationId,
      branchId: updated.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ADMISSIONS",
      entityId: updated.id,
      details: { applicationNo: updated.applicationNo, status: updated.status, context: "DOCUMENT_VERIFICATION" }
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Verify documents error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update document verification", 500);
  }
}
