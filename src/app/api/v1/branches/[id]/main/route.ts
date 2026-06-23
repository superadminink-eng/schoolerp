import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantContext, checkApiPermission } from "@/lib/rbac";
import { apiSuccess, apiError } from "@/lib/api-helpers";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getTenantContext(req);

  // Strict Silicon Valley Security Check: Only Organization Owners (SCHOOL_ADMIN) can transfer headquarters
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN") {
    return apiError("FORBIDDEN", "Only School Admins can change the Headquarters (Main Branch)", 403);
  }

  const { id } = await context.params;
  const branchId = id;

  try {
    // 1. Verify the target branch exists within the same organization
    const targetBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId: ctx.organizationId,
      },
    });

    if (!targetBranch) {
      return apiError("NOT_FOUND", "Branch not found in this organization", 404);
    }

    if (targetBranch.isMain) {
      return apiSuccess({ message: "This branch is already the Headquarters" });
    }

    // 2. The Atomic Transfer (Bulletproof Transaction)
    // We demote all branches to regular, and promote the selected one to Main in a single millisecond tick.
    await prisma.$transaction(async (tx) => {
      // Step A: Demote current main branches (false)
      await tx.branch.updateMany({
        where: { organizationId: ctx.organizationId },
        data: { isMain: false },
      });

      // Step B: Promote the new branch (true)
      await tx.branch.update({
        where: { id: branchId },
        data: { isMain: true },
      });
    });

    // Fetch the updated branch to return it
    const updatedBranch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    return apiSuccess(updatedBranch);
  } catch (error) {
    console.error("Transfer Headquarters error:", error);
    return apiError("INTERNAL_ERROR", "Failed to transfer headquarters", 500);
  }
}
