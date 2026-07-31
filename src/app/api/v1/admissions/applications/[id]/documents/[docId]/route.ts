import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteUploadedFile } from "@/lib/upload";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    
    // 1. Auth check
    const denied = await checkApiPermission(request, "admissions", "registrar_desk");
    if (denied) return denied;

    const ctx = getTenantContext(request);

    // 2. Strict Tenant Scope Check
    const whereCondition: any = {
      id,
      organizationId: ctx.organizationId,
    };
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      whereCondition.branchId = ctx.branchId;
    }

    const application = await prisma.admissionApplication.findFirst({
      where: whereCondition,
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Application not found or unauthorized" } },
        { status: 404 }
      );
    }

    // 3. Find target document
    const targetDoc = await prisma.applicationDocument.findFirst({
      where: {
        id: docId,
        applicationId: id,
      }
    });

    if (!targetDoc) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Document not found" } },
        { status: 404 }
      );
    }

    // 4. Delete physical file from storage
    if (targetDoc.filePath) {
      await deleteUploadedFile(targetDoc.filePath);
    }

    // 5. Delete document record from database
    await prisma.applicationDocument.delete({
      where: { id: docId }
    });

    // 5b. Auto-revert status to SUBMITTED (Intake tab) if 0 documents remain
    const remainingDocsCount = await prisma.applicationDocument.count({
      where: { applicationId: id }
    });

    if (remainingDocsCount === 0 && application.status === "DOCUMENT_VERIFICATION") {
      await prisma.admissionApplication.update({
        where: { id },
        data: { status: "SUBMITTED" }
      });
    }

    // 6. Fetch full updated application for live UI state sync
    const updatedApplication = await prisma.admissionApplication.findUnique({
      where: { id },
      include: {
        academicYear: true,
        class: true,
        branch: true,
        documents: true,
        examResult: true,
      }
    });

    // 7. Log Audit Action for Compliance
    await logAction({
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: "DELETE",
      module: "ADMISSIONS",
      entityId: id,
      details: {
        documentId: docId,
        documentType: targetDoc.documentType,
        context: "DOCUMENT_CHECKLIST_DELETE"
      }
    });

    return NextResponse.json({
      success: true,
      application: updatedApplication
    });
  } catch (error: any) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to delete document" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    
    // 1. Auth check
    const denied = await checkApiPermission(request, "admissions", "registrar_desk");
    if (denied) return denied;

    const ctx = getTenantContext(request);
    const body = await request.json();
    const { status, remarks } = body;

    if (!status || !["VERIFIED", "REJECTED", "PENDING", "HARDCOPY_SUBMITTED"].includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid status provided" } },
        { status: 400 }
      );
    }

    // 2. Strict Tenant Scope Check
    const whereCondition: any = {
      id,
      organizationId: ctx.organizationId,
    };
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      whereCondition.branchId = ctx.branchId;
    }

    const application = await prisma.admissionApplication.findFirst({
      where: whereCondition,
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Application not found or unauthorized" } },
        { status: 404 }
      );
    }

    // 3. Update document status
    const targetDoc = await prisma.applicationDocument.update({
      where: {
        id: docId,
        applicationId: id,
      },
      data: {
        status,
        remarks: remarks !== undefined ? remarks : null,
      }
    });

    // 4. Fetch full updated application for live UI state sync
    const updatedApplication = await prisma.admissionApplication.findUnique({
      where: { id },
      include: {
        academicYear: true,
        class: true,
        branch: true,
        documents: true,
        examResult: true,
      }
    });

    // 5. Log Audit Action for Compliance
    await logAction({
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ADMISSIONS",
      entityId: id,
      details: {
        documentId: docId,
        documentType: targetDoc.documentType,
        newStatus: status,
        remarks: remarks || "",
        context: "DOCUMENT_INSTANT_VERIFICATION"
      }
    });

    return NextResponse.json({
      success: true,
      application: updatedApplication,
      message: `Document ${status.toLowerCase()} successfully`,
    });
  } catch (error: any) {
    console.error("Failed to update document status:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to update document" } },
      { status: 500 }
    );
  }
}
