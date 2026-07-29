import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveUploadedDocument } from "@/lib/upload";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const DEFAULT_REQUIRED_DOCS = [
  { type: "BIRTH_CERTIFICATE", label: "Birth Certificate", mandatory: true },
  { type: "STUDENT_PHOTO", label: "Student Photo", mandatory: true },
  { type: "AADHAAR_CARD", label: "Aadhaar Card", mandatory: true },
  { type: "ADDRESS_PROOF", label: "Address Proof", mandatory: false },
  { type: "PREVIOUS_MARKSHEET", label: "Previous Marksheet", mandatory: false },
];

/**
 * GET /api/v1/public/upload-docs/[token]
 * Public endpoint for parents to view student details & required documents.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const tokenRecord = await prisma.applicationToken.findUnique({
      where: { token },
      include: {
        application: {
          include: {
            class: { select: { name: true } },
            branch: { select: { name: true } },
            organization: { select: { name: true, logo: true } },
            documents: true,
          },
        },
      } as any,
    });

    const app = (tokenRecord as any)?.application;

    if (!tokenRecord || !app) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Invalid or expired magic link" } },
        { status: 404 }
      );
    }

    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED", message: "This magic link has expired. Please contact the school desk for a new link." } },
        { status: 410 }
      );
    }

    const uploadedDocs = app.documents || [];

    // Map required checklist with current uploaded states
    const checklist = DEFAULT_REQUIRED_DOCS.map((reqDoc) => {
      const existing = uploadedDocs.find((d: any) => d.documentType === reqDoc.type);
      return {
        type: reqDoc.type,
        label: reqDoc.label,
        mandatory: reqDoc.mandatory,
        id: existing?.id || null,
        fileName: existing?.fileName || null,
        filePath: existing?.filePath || null,
        fileSize: existing?.fileSize || null,
        status: existing?.status || "NOT_UPLOADED",
        remarks: existing?.remarks || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        studentName: `${app.firstName} ${app.lastName}`.trim(),
        applicationNo: app.applicationNo,
        className: app.class?.name || "",
        branchName: app.branch?.name || app.organization?.name || "School ERP",
        branchLogo: app.organization?.logo || null,
        applicationStatus: app.status,
        checklist,
      },
    });
  } catch (error: any) {
    console.error("Public GET upload-docs error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to load upload portal" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/public/upload-docs/[token]
 * Public endpoint for parents to upload a file for a specific documentType.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const tokenRecord = await prisma.applicationToken.findUnique({
      where: { token },
      include: {
        application: true,
      } as any,
    });

    const app = (tokenRecord as any)?.application;

    if (!tokenRecord || !app) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Invalid or expired magic link" } },
        { status: 404 }
      );
    }

    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED", message: "This magic link has expired." } },
        { status: 410 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string | null;

    if (!file || !documentType) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "File and documentType are required" } },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid file format. Please upload JPG, PNG, WEBP, or PDF." } },
        { status: 400 }
      );
    }

    // File size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "File size exceeds 10MB limit." } },
        { status: 400 }
      );
    }

    // Save physical file using saveUploadedDocument(file, subDir, prefix)
    const subDir = `uploads/${app.organizationId}/${app.branchId}/applications/${app.id}`;
    const uploadResult = await saveUploadedDocument(file, subDir, documentType);

    // Check if document record already exists for this documentType
    const existingDoc = await prisma.applicationDocument.findFirst({
      where: {
        applicationId: app.id,
        documentType,
      },
    });

    let docRecord;
    if (existingDoc) {
      docRecord = await prisma.applicationDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: uploadResult.fileName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          status: "PENDING", // Reset to pending for counselor review!
          remarks: null, // Clear previous rejection remarks
        },
      });
    } else {
      docRecord = await prisma.applicationDocument.create({
        data: {
          applicationId: app.id,
          documentType,
          fileName: uploadResult.fileName,
          filePath: uploadResult.filePath,
          fileSize: uploadResult.fileSize,
          status: "PENDING",
        },
      });
    }

    return NextResponse.json({
      success: true,
      document: docRecord,
      message: `${documentType.replace(/_/g, " ")} uploaded successfully!`,
    });
  } catch (error: any) {
    console.error("Public POST upload-docs error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to upload document" } },
      { status: 500 }
    );
  }
}
