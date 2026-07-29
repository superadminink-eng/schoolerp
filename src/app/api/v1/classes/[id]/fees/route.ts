import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getTenantContext, hasPermission } from "@/lib/rbac";

type RouteContext = any;

/**
 * GET /api/v1/classes/:id/fees — list fees for a class (for student form)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const ctx = getTenantContext(req);
  const isSuperOrSchoolAdmin = ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "SCHOOL_ADMIN";
  let allowed = isSuperOrSchoolAdmin;
  
  if (!allowed) {
    const [hasFeeRead, hasAdmissionsVerify, hasRegistrar] = await Promise.all([
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "fees", "read"),
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "document_verification"),
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "registrar_desk"),
    ]);
    allowed = hasFeeRead || hasAdmissionsVerify || hasRegistrar;
  }
  
  if (!allowed) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }

  const { id } = await context.params;

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!classRecord) {
      return apiError("NOT_FOUND", "Class not found", 404);
    }

    const url = new URL(req.url);
    const termType = url.searchParams.get("termType");

    const whereClause: any = { classId: id };
    if (termType) {
      whereClause.termType = termType;
    }

    const feeStructures = await prisma.feeStructure.findMany({
      where: whereClause,
      include: {
        feeCategory: { select: { name: true } },
      },
    });

    const fees = feeStructures.map((fs) => ({
      id: fs.id,
      name: fs.feeCategory.name,
      amount: Number(fs.amount),
      frequency: fs.frequency,
      applicability: fs.applicability,
    }));

    return apiSuccess(fees);
  } catch (error) {
    console.error("List class fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list fees", 500);
  }
}
