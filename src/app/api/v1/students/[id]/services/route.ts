import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission } from "@/lib/rbac";
import { FeeService, TenantContext } from "@/services/fee-service";
import { z } from "zod";

type RouteContext = any;

const serviceActionSchema = z.object({
  feeStructureId: z.string().min(1, "FeeStructure ID is required"),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "services", "create");
  if (denied) return denied;

  const { id: studentId } = await context.params;

  try {
    const body = await req.json();
    const parsed = serviceActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0].message, 400);
    }

    const { feeStructureId } = parsed.data;

    // We need tenant context for logging
    const tenantCtx: TenantContext = {
      userId: req.headers.get("x-user-id") || "system",
      roleId: req.headers.get("x-role-id") || "",
      roleName: req.headers.get("x-role-name") || "",
      organizationId: req.headers.get("x-org-id") || "",
      branchId: req.headers.get("x-branch-id") || null,
    };

    if (!tenantCtx.organizationId) {
       return apiError("UNAUTHORIZED", "Missing organization context", 401);
    }

    const result = await FeeService.addMidYearService(tenantCtx, studentId, feeStructureId);
    return apiSuccess(result);
  } catch (error: any) {
    console.error("Add mid-year service error:", error);
    if (error.message === "STUDENT_NOT_FOUND") return apiError("NOT_FOUND", "Student not found", 404);
    if (error.message === "FEE_STRUCTURE_NOT_FOUND") return apiError("NOT_FOUND", "Fee structure not found", 404);
    if (error.message === "SERVICE_ALREADY_ACTIVE") return apiError("BAD_REQUEST", "Service is already active for this student", 400);
    return apiError("INTERNAL_ERROR", "Failed to add service", 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "services", "delete");
  if (denied) return denied;

  const { id: studentId } = await context.params;

  try {
    const body = await req.json();
    const parsed = serviceActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0].message, 400);
    }

    const { feeStructureId } = parsed.data;

    const tenantCtx: TenantContext = {
      userId: req.headers.get("x-user-id") || "system",
      roleId: req.headers.get("x-role-id") || "",
      roleName: req.headers.get("x-role-name") || "",
      organizationId: req.headers.get("x-org-id") || "",
      branchId: req.headers.get("x-branch-id") || null,
    };

    if (!tenantCtx.organizationId) {
       return apiError("UNAUTHORIZED", "Missing organization context", 401);
    }

    const result = await FeeService.removeMidYearService(tenantCtx, studentId, feeStructureId);
    return apiSuccess(result);
  } catch (error: any) {
    console.error("Remove mid-year service error:", error);
    if (error.message === "STUDENT_NOT_FOUND") return apiError("NOT_FOUND", "Student not found", 404);
    if (error.message === "SERVICE_NOT_ACTIVE") return apiError("BAD_REQUEST", "Service is not active for this student", 400);
    return apiError("INTERNAL_ERROR", "Failed to remove service", 500);
  }
}
