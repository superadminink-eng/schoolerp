import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getTenantContext, hasPermission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
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
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  const academicYearId = url.searchParams.get("academicYearId");
  const termType = url.searchParams.get("termType") || "FULL_TERM";

  if (!classId || !academicYearId) {
    return apiError("BAD_REQUEST", "Missing classId or academicYearId", 400);
  }

  try {
    const templates = await prisma.feeInstallmentTemplate.findMany({
      where: {
        classId,
        academicYearId,
        termType: termType as any,
      },
      orderBy: { dueDate: "asc" },
    });

    return apiSuccess(templates);
  } catch (error) {
    console.error("List fee installment templates error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list fee installment templates", 500);
  }
}
