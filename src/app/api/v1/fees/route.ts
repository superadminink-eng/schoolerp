import { NextRequest } from "next/server";
import { apiSuccess, apiError, parsePagination } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { FeeService } from "@/services/fee-service";

/**
 * GET /api/v1/fees — list students with pending fees
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "fees", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");

  try {
    const { rows, total } = await FeeService.listPendingFees(ctx, branchId, search, page, limit);
    return apiSuccess(rows, { page, limit, total });
  } catch (error) {
    console.error("List pending fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list pending fees", 500);
  }
}
