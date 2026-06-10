import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { logAction } from "@/lib/audit";

/**
 * POST /api/v1/admissions/demo-clear — Safely delete sandbox demo data
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "admissions", "document_verification");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") || ctx.branchId;

  if (!branchId) {
    return apiError("BAD_REQUEST", "branchId is required", 400);
  }

  // Restrict branch-scoped roles to their home branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot clear data in another branch", 403);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete all demo applications in the branch (previousSchool = 'DEMO_SANDBOX' or name fallback)
      const deletedApps = await tx.admissionApplication.deleteMany({
        where: {
          branchId,
          organizationId: ctx.organizationId,
          OR: [
            { previousSchool: "DEMO_SANDBOX" },
            { firstName: { in: ["Rohan", "Aarav", "Isha", "Ananya"] } },
          ],
        },
      });

      // 2. Delete all demo inquiries in the branch (notes starts with 'DEMO_DATA' or name fallback)
      const deletedInquiries = await tx.admissionInquiry.deleteMany({
        where: {
          branchId,
          organizationId: ctx.organizationId,
          OR: [
            { notes: { startsWith: "DEMO_DATA" } },
            { studentName: "Aditya Kulkarni" },
          ],
        },
      });

      return {
        applicationsCount: deletedApps.count,
        inquiriesCount: deletedInquiries.count,
      };
    });

    await logAction({
      organizationId: ctx.organizationId,
      branchId,
      userId: ctx.userId,
      action: "DELETE",
      module: "ADMISSIONS",
      entityId: "DEMO_CLEAR",
      details: {
        message: "Cleared admissions demo data",
        applicationsCount: result.applicationsCount,
        inquiriesCount: result.inquiriesCount,
      },
    });

    return apiSuccess({
      message: `Successfully cleared ${result.applicationsCount} applications and ${result.inquiriesCount} inquiries.`,
      cleared: result,
    });
  } catch (error) {
    console.error("Clear admissions demo data error:", error);
    return apiError("INTERNAL_ERROR", "Failed to clear admissions demo data", 500);
  }
}
