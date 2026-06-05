import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createBranchSchema } from "@/lib/validations/branch";

/**
 * GET /api/v1/branches — list branches (lightweight for dropdowns + paginated for list page)
 */
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return apiError("UNAUTHORIZED", "Not authenticated", 401);
  }

  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const paginated = url.searchParams.get("paginated") === "true";

  if (!paginated) {
    // Lightweight response for dropdowns (original Behavior)
    const branches = await prisma.branch.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        phone: true,
        email: true,
        isMain: true,
        isActive: true,
        hasEntranceTest: true,
      },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
    });

    return apiSuccess(branches);
  }

  // Paginated response for the list page
  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
    ];
  }

  try {
    const [branches, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          phone: true,
          email: true,
          isMain: true,
          isActive: true,
          hasEntranceTest: true,
          createdAt: true,
        },
        orderBy: [{ isMain: "desc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.branch.count({ where }),
    ]);

    return apiSuccess(branches, { page, limit, total });
  } catch (error) {
    console.error("List branches error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list branches", 500);
  }
}

/**
 * POST /api/v1/branches — create a new branch
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "branches", "manage");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createBranchSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, code, address, phone, email, hasEntranceTest } = parsed.data;

  try {
    // Check code uniqueness within organization
    const existing = await prisma.branch.findFirst({
      where: { organizationId: ctx.organizationId, code },
    });
    if (existing) {
      return apiError("CONFLICT", "A branch with this code already exists", 409);
    }

    const branch = await prisma.branch.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        code,
        address: address || null,
        phone: phone || null,
        email: email || null,
        hasEntranceTest: hasEntranceTest !== undefined ? hasEntranceTest : true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        isMain: true,
        isActive: true,
        hasEntranceTest: true,
        createdAt: true,
      },
    });

    return apiSuccess(branch, undefined, 201);
  } catch (error) {
    console.error("Create branch error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create branch", 500);
  }
}
