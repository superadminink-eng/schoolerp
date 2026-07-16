import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateSubjectMasterSchema } from "@/lib/validations/subject-master";

type RouteContext = any;

/**
 * GET /api/v1/subject-masters/:id — get a single subject master
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "subjects", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const subjectMaster = await prisma.subjectMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!subjectMaster) return apiNotFound("Subject");

    return apiSuccess(subjectMaster);
  } catch (error) {
    console.error("Get subject master error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get subject", 500);
  }
}

/**
 * PATCH /api/v1/subject-masters/:id — update a subject master
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "subjects", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateSubjectMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existing = await prisma.subjectMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Subject");

    const { code, name } = parsed.data;

    // Check unique code if changing
    if (code && code !== existing.code) {
      const duplicateCode = await prisma.subjectMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          code,
          id: { not: id },
        },
      });
      if (duplicateCode) {
        return apiError(
          "CONFLICT",
          `A subject with code "${code}" already exists`,
          409
        );
      }
    }

    // Check unique name if changing
    if (name && name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
      const duplicateName = await prisma.subjectMaster.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: name.trim(),
          id: { not: id },
        },
      });
      if (duplicateName) {
        return apiError(
          "CONFLICT",
          `A subject with the name "${name}" already exists`,
          409
        );
      }
    }

    const updated = await prisma.subjectMaster.update({
      where: { id },
      data: parsed.data,
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Update subject master error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update subject", 500);
  }
}

/**
 * DELETE /api/v1/subject-masters/:id — soft-delete (deactivate) or hard-delete
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "subjects", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.subjectMaster.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) return apiNotFound("Subject");

    // Check if any class Subject references this master
    const refCount = await prisma.subject.count({
      where: { subjectMasterId: id },
    });

    if (refCount > 0) {
      // Return 409 Conflict to force the user to explicitly archive via PATCH
      return NextResponse.json({
        success: false,
        error: {
          code: "HAS_DEPENDENCIES",
          message: `Cannot delete because ${refCount} class subject(s) reference this entry. Please 'Deactivate' it from the Edit menu instead.`,
          meta: { refCount }
        }
      }, { status: 409 });
    }

    // Hard delete — no references
    await prisma.subjectMaster.delete({ where: { id } });
    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete subject master error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete subject", 500);
  }
}
