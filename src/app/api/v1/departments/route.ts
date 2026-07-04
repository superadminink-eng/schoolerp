import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createDepartmentMasterSchema } from "@/lib/validations/department-master";

/**
 * GET /api/v1/departments — list department masters for an organization
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "departments", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const activeOnly = url.searchParams.get("active") !== "false";

  try {
    const where: Record<string, unknown> = {
      organizationId: ctx.organizationId,
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

    const departments = await prisma.departmentMaster.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    return apiSuccess(departments);
  } catch (error) {
    console.error("List departments error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list departments", 500);
  }
}

/**
 * POST /api/v1/departments — create a new department master
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "departments", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createDepartmentMasterSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, code, description } = parsed.data;

  try {
    const existing = await prisma.departmentMaster.findFirst({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          { code },
          { name: name.trim() }
        ]
      }
    });

    if (existing) {
      if (existing.isActive) {
        if (existing.code === code) {
          return apiError("CONFLICT", `A department with code "${code}" already exists`, 409);
        } else {
          return apiError("CONFLICT", `A department with the name "${name}" already exists`, 409);
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ARCHIVED_CONFLICT",
              message: `A department with the ${existing.code === code ? `code "${code}"` : `name "${name}"`} already exists in your Archives.`,
              meta: { duplicateId: existing.id },
            },
          },
          { status: 409 }
        );
      }
    }

    const created = await prisma.departmentMaster.create({
      data: {
        organizationId: ctx.organizationId,
        name: name.trim(),
        code,
        description: description || null,
        isActive: true,
      },
    });

    return apiSuccess(created, undefined, 201);
  } catch (error) {
    console.error("Create department error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create department", 500);
  }
}
