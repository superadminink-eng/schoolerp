import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedDocument, deleteUploadedFile, UploadError } from "@/lib/upload";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Auth check
    const denied = await checkApiPermission(request, "admissions", "registrar_desk");
    if (denied) return denied;

    const ctx = getTenantContext(request);

    const formData = await request.formData();
    const documentType = formData.get("documentType") as string;
    const file = formData.get("file") as File;

    if (!documentType || !file) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Document type and file are required" } },
        { status: 400 }
      );
    }

    // 2. Strict Tenant Scope Check (Prevents cross-tenant access)
    const whereCondition: any = {
      id,
      organizationId: ctx.organizationId,
    };
    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      whereCondition.branchId = ctx.branchId;
    }

    const application = await prisma.admissionApplication.findFirst({
      where: whereCondition,
      include: {
        branch: true,
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Application not found or unauthorized" } },
        { status: 404 }
      );
    }

    const orgId = application.organizationId;
    const branchId = application.branchId;
    const appId = application.id;

    // Secure, multi-tenant path avoiding ID collisions
    const uploadPath = `uploads/${orgId}/${branchId}/applications/${appId}`;

    // 3. Save Document (Supports PDF & Images, validates magic bytes)
    const uploadResult = await saveUploadedDocument(
      file,
      uploadPath,
      documentType
    );

    // 4. Check if document exists & clean up orphan file
    const existingDoc = await prisma.applicationDocument.findFirst({
      where: {
        applicationId: appId,
        documentType: documentType
      }
    });

    let savedDoc;
    if (existingDoc) {
      // Clean up previous physical file to prevent storage leaks
      if (existingDoc.filePath && existingDoc.filePath !== uploadResult.filePath) {
        await deleteUploadedFile(existingDoc.filePath);
      }

      savedDoc = await prisma.applicationDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: uploadResult.fileName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          status: "PENDING",
          remarks: null,
        }
      });
    } else {
      savedDoc = await prisma.applicationDocument.create({
        data: {
          applicationId: appId,
          documentType: documentType,
          fileName: uploadResult.fileName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          status: "PENDING"
        }
      });
    }

    // 5. Fetch full updated application for instant UI state synchronization
    const updatedApplication = await prisma.admissionApplication.findUnique({
      where: { id: appId },
      include: {
        academicYear: true,
        class: true,
        branch: true,
        documents: true,
        examResult: true,
              }
    });

    // 6. Log Audit Action for Enterprise Compliance
    await logAction({
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      userId: ctx.userId,
      action: "UPDATE",
      module: "ADMISSIONS",
      entityId: appId,
      details: {
        documentId: savedDoc.id,
        documentType: savedDoc.documentType,
        fileName: savedDoc.fileName,
        context: "DOCUMENT_CHECKLIST_UPLOAD"
      }
    });

    return NextResponse.json({
      success: true,
      data: savedDoc,
      application: updatedApplication
    });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 422 }
      );
    }
    console.error("Failed to upload document:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to upload document" } },
      { status: 500 }
    );
  }
}
