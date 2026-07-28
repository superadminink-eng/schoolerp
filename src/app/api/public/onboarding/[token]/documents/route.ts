import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage, UploadError } from "@/lib/upload";

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const appToken = await prisma.applicationToken.findUnique({
      where: { token: params.token },
      include: { application: true }
    });

    if (!appToken) {
      return NextResponse.json({ success: false, error: { message: "Invalid or expired link." } }, { status: 404 });
    }
    
    if (new Date() > appToken.expiresAt || appToken.isConsumed || appToken.application.status === "ADMITTED" || appToken.application.status === "REJECTED") {
      return NextResponse.json({ success: false, error: { message: "Link locked." } }, { status: 403 });
    }

    const formData = await request.formData();
    const documentType = formData.get("documentType") as string;
    const file = formData.get("file") as File;

    if (!documentType || !file) {
      return NextResponse.json({ success: false, error: { message: "Document type and file are required" } }, { status: 400 });
    }

    // 5MB limit check (redundant if handled by multer/busboy, but good for safety)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: { message: "File exceeds 5MB limit" } }, { status: 400 });
    }

    const application = appToken.application;
    const uploadPath = `uploads/${application.organizationId}/${application.branchId}/applications/${application.id}`;

    const uploadResult = await saveUploadedImage(
      file,
      uploadPath,
      documentType,
      "document"
    );

    if (uploadResult instanceof UploadError) {
      return NextResponse.json({ success: false, error: { message: uploadResult.message } }, { status: 500 });
    }

    // Upsert the document
    const existingDoc = await prisma.applicationDocument.findFirst({
      where: {
        applicationId: application.id,
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
          remarks: null,
        }
      });
    } else {
      savedDoc = await prisma.applicationDocument.create({
        data: {
          applicationId: application.id,
          documentType: documentType,
          fileName: uploadResult.fileName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          status: "PENDING"
        }
      });
    }

    return NextResponse.json({ success: true, data: { id: savedDoc.id, documentType: savedDoc.documentType, status: savedDoc.status } });
  } catch (error: any) {
    console.error("Failed to upload public document:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error." } }, { status: 500 });
  }
}
