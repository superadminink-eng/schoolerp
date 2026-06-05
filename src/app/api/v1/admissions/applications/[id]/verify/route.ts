import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/admissions/applications/[id]/verify — Verify uploaded documents
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

  const { documents, applicationStatus, verificationNotes } = body as {
    documents?: { id: string; status: "PENDING" | "VERIFIED" | "REJECTED"; remarks?: string }[];
    applicationStatus?: "DOCUMENT_VERIFICATION" | "SHORTLISTED" | "REJECTED" | "TEST_SCHEDULED";
    verificationNotes?: string;
  };

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
    const updated = await prisma.$transaction(async (tx) => {
      // Update individual documents if provided
      if (documents && documents.length > 0) {
        for (const doc of documents) {
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
          include: { documents: true, examResult: true },
        });
      }

      return tx.admissionApplication.findUnique({
        where: { id },
        include: { documents: true, examResult: true },
      });
    }, { timeout: 15000 });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Verify documents error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update document verification", 500);
  }
}
