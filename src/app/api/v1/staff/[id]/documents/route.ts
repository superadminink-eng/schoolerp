import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { staffDocumentLabelSchema } from "@/lib/validations/staff-document";
import {
  saveUploadedImage,
  UploadError,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from "@/lib/upload";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verify that a staff member belongs to the caller's organization (and branch for BRANCH_ADMIN).
 */
async function verifyStaffAccess(
  staffId: string,
  ctx: ReturnType<typeof getTenantContext>
) {
  const where: Record<string, unknown> = {
    id: staffId,
    branch: { organizationId: ctx.organizationId },
  };
  if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
    where.branchId = ctx.branchId;
  }
  return prisma.staff.findFirst({ where, select: { id: true } });
}

/**
 * GET /api/v1/staff/:id/documents — list all documents for a staff member
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "staff", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  const staff = await verifyStaffAccess(id, ctx);
  if (!staff) return apiNotFound("Staff member");

  try {
    const documents = await prisma.staffDocument.findMany({
      where: { staffId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        fileName: true,
        filePath: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return apiSuccess(documents);
  } catch (error) {
    console.error("List staff documents error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list documents", 500);
  }
}

/**
 * POST /api/v1/staff/:id/documents — upload a document for a staff member
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "staff", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  const staff = await verifyStaffAccess(id, ctx);
  if (!staff) return apiNotFound("Staff member");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("BAD_REQUEST", "Invalid form data", 400);
  }

  const file = formData.get("file");
  const label = formData.get("label");

  if (!file || !(file instanceof File)) {
    return apiError("BAD_REQUEST", "No file provided", 400);
  }

  if (typeof label !== "string") {
    return apiError("BAD_REQUEST", "No label provided", 400);
  }

  // Validate label
  const labelResult = staffDocumentLabelSchema.safeParse(label);
  if (!labelResult.success) {
    return apiError(
      "VALIDATION_ERROR",
      labelResult.error.errors[0].message,
      422
    );
  }

  // Validate file type
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
    )
  ) {
    return apiError(
      "VALIDATION_ERROR",
      `Invalid file type "${file.type}". Allowed: JPEG, PNG, WebP`,
      422
    );
  }

  // Validate file size
  if (file.size > MAX_IMAGE_SIZE) {
    return apiError(
      "VALIDATION_ERROR",
      `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 2MB`,
      422
    );
  }

  try {
    const uploadResult = await saveUploadedImage(
      file,
      "uploads/staff-documents",
      id
    );

    const document = await prisma.staffDocument.create({
      data: {
        staffId: id,
        label: labelResult.data,
        fileName: uploadResult.fileName,
        filePath: uploadResult.filePath,
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
      },
      select: {
        id: true,
        label: true,
        fileName: true,
        filePath: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return apiSuccess(document, undefined, 201);
  } catch (error) {
    if (error instanceof UploadError) {
      return apiError("VALIDATION_ERROR", error.message, 422);
    }
    console.error("Upload staff document error:", error);
    return apiError("INTERNAL_ERROR", "Failed to upload document", 500);
  }
}
