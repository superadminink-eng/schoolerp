import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage, UploadError } from "@/lib/upload";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth check
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

    const application = await prisma.admissionApplication.findUnique({
      where: { id },
      include: {
        branch: true,
      }
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Application not found" } },
        { status: 404 }
      );
    }

    // Upload to local storage for now (with proper multi-tenant path)
    const orgId = application.organizationId;
    const branchId = application.branchId;
    const appId = application.id;

    // Secure path avoiding ID collisions
    const uploadPath = `uploads/${orgId}/${branchId}/applications/${appId}`;

    const uploadResult = await saveUploadedImage(
      file,
      uploadPath,
      documentType,
      "document"
    );

    if (uploadResult instanceof UploadError) {
      console.error("Document upload error:", uploadResult);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: uploadResult.message } },
        { status: 500 }
      );
    }

    // Check if a document of this type already exists, if so update it, else create
    const existingDoc = await prisma.applicationDocument.findFirst({
      where: {
        applicationId: appId,
        documentType: documentType
      }
    });

    let savedDoc;
    if (existingDoc) {
      savedDoc = await prisma.applicationDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: uploadResult.fileName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          status: "PENDING",
          remarks: null, // Reset remarks on new upload
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

    return NextResponse.json({ success: true, data: savedDoc });
  } catch (error: any) {
    console.error("Failed to upload document:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to upload document" } },
      { status: 500 }
    );
  }
}
