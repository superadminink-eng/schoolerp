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

  const { documents, applicationStatus, verificationNotes, archiveReason, isProvisional, overrideReason, provisionalDeadline } = body as {
    documents?: { id: string; status: "PENDING" | "VERIFIED" | "REJECTED" | "HARDCOPY_SUBMITTED"; remarks?: string }[];
    applicationStatus?: "DOCUMENT_VERIFICATION" | "SHORTLISTED" | "REJECTED" | "TEST_SCHEDULED";
    verificationNotes?: string;
    archiveReason?: string;
    isProvisional?: boolean;
    overrideReason?: string;
    provisionalDeadline?: string | null;
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

      // Fetch all current documents for this application to enforce status guardrail
      const allDocs = await tx.applicationDocument.findMany({
        where: { applicationId: id },
      });

      const hasRejected = allDocs.some((d) => d.status === "REJECTED");
      const hasPending = allDocs.some((d) => d.status === "PENDING");

      // Mandatory check (aligns with DOCUMENT_META in frontend)
      const mandatoryTypes = ["BIRTH_CERTIFICATE", "STUDENT_PHOTO", "AADHAAR_CARD"]; // Standard mandatory set
      const hasAllMandatory = mandatoryTypes.every(type => 
        allDocs.some(d => d.documentType === type && d.status !== "REJECTED")
      );

      let finalStatus = applicationStatus || application.status;
      
      // Provisional Admission Bypass Validation
      const isBypassValid = isProvisional && overrideReason && overrideReason.trim() !== "" && provisionalDeadline;

      if (hasRejected && !isBypassValid) {
        // Only force reject if there's no bypass (though usually rejection isn't bypassed, but we allow provisional if required)
        if (!isProvisional) finalStatus = "REJECTED";
      } else if (hasPending || !hasAllMandatory) {
        // Guardrail: Cannot promote to SHORTLISTED or TEST_SCHEDULED if documents are pending/missing
        if ((finalStatus === "SHORTLISTED" || finalStatus === "TEST_SCHEDULED") && !isBypassValid) {
          // Instead of silent fallback, we reject the request completely for strict validation
          throw new Error("Validation Failed: Mandatory documents are missing or pending, and provisional bypass is not provided.");
        }
      }

      // Update application fields (status, verificationNotes)
      const dataToUpdate: Record<string, any> = {};
      dataToUpdate.status = finalStatus;
      if (finalStatus === "REJECTED") {
        dataToUpdate.statusBeforeArchive = application.status;
        dataToUpdate.archiveReason = archiveReason || null;
      }
      if (verificationNotes !== undefined) {
        dataToUpdate.verificationNotes = verificationNotes;
      }
      
      // Apply Provisional fields if valid
      if (isBypassValid && (finalStatus === "SHORTLISTED" || finalStatus === "TEST_SCHEDULED")) {
        dataToUpdate.isProvisional = true;
        dataToUpdate.overrideReason = overrideReason;
        dataToUpdate.provisionalDeadline = new Date(provisionalDeadline);
        dataToUpdate.overriddenById = ctx.userId || "system";
      } else if (hasAllMandatory && !hasPending) {
        // Clear provisional if requirements are fully met
        dataToUpdate.isProvisional = false;
        dataToUpdate.overrideReason = null;
        dataToUpdate.provisionalDeadline = null;
        dataToUpdate.overriddenById = null;
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
      action: updated.isProvisional && !application.isProvisional ? "PROVISIONAL_ADMISSION_GRANTED" : "UPDATE",
      module: "ADMISSIONS",
      entityId: updated.id,
      details: { 
        applicationNo: updated.applicationNo, 
        status: updated.status, 
        context: "DOCUMENT_VERIFICATION",
        ...(updated.isProvisional && !application.isProvisional ? {
          reason: updated.overrideReason,
          deadline: updated.provisionalDeadline
        } : {})
      }
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Verify documents error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update document verification", 500);
  }
}
