import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { deleteUploadedFile } from "@/lib/upload";

type RouteContext = any;

/**
 * DELETE /api/v1/staff/:id/documents/:docId — delete a staff document
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "staff", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id, docId } = await context.params;

  try {
    // Verify staff belongs to caller's org
    const staffWhere: Record<string, unknown> = {
      id,
      organizationId: ctx.organizationId,
    };
    if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
      staffWhere.branchId = ctx.branchId;
    }

    const staff = await prisma.staff.findFirst({
      where: staffWhere,
      select: { id: true },
    });
    if (!staff) return apiNotFound("Staff member");

    // Verify document belongs to this staff member
    const document = await prisma.staffDocument.findFirst({
      where: { id: docId, staffId: id },
    });
    if (!document) return apiNotFound("Document");

    // Delete file from disk
    await deleteUploadedFile(document.filePath);

    // Delete DB record
    await prisma.staffDocument.delete({ where: { id: docId } });

    return apiSuccess({ id: docId, deleted: true });
  } catch (error) {
    console.error("Delete staff document error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete document", 500);
  }
}
