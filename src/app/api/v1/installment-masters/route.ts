import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createInstallmentMasterSchema } from "@/lib/validations/installment-master";

/**
 * GET /api/v1/installment-masters — list installment masters for an organization
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "fees", "read"); // using fees perm for now
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const activeOnly = url.searchParams.get("active") !== "false";

  try {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };
    if (activeOnly) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const installmentMasters = await prisma.installmentMaster.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return apiSuccess(installmentMasters);
  } catch (error) {
    console.error("List installment masters error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list installment masters", 500);
  }
}

/**
 * POST /api/v1/installment-masters — create a new installment master
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "fees", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createInstallmentMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, code, description } = parsed.data;

  try {
    // Check for unique name or code per org, including deleted ones for Smart Restore
    const existing = await prisma.installmentMaster.findFirst({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { code },
          { name: name.trim() }
        ]
      }
    });

    if (existing) {
      if (!existing.deletedAt && existing.isActive) {
        if (existing.code === code) {
          return apiError("CONFLICT", `An installment master with code "${code}" already exists`, 409);
        } else {
          return apiError("CONFLICT", `An installment master with the name "${name}" already exists`, 409);
        }
      } else {
        // Return special code for smart reactivation
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ARCHIVED_CONFLICT",
              message: `An installment master with the ${existing.code === code ? `code "${code}"` : `name "${name}"`} already exists in your Archives.`,
              meta: { duplicateId: existing.id },
            },
          },
          { status: 409 }
        );
      }
    }

    const created = await prisma.installmentMaster.create({
      data: {
        organizationId: ctx.organizationId,
        name: name.trim(),
        code,
        description,
      },
    });

    return apiSuccess(created);
  } catch (error: any) {
    console.error("Create installment master error:", error);
    if (error?.code === "P2002") {
      return apiError("CONFLICT", "An installment master with this name or code already exists", 409);
    }
    return apiError("INTERNAL_ERROR", "Failed to create installment master", 500);
  }
}
