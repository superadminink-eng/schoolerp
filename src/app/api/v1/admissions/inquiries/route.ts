import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { createInquirySchema } from "@/lib/validations/admission";

/**
 * GET /api/v1/admissions/inquiries — List and filter inquiries with tenancy checking
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "admissions", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");
  const status = url.searchParams.get("status");
  const classId = url.searchParams.get("classAppliedId");

  const where: Record<string, any> = {
    organizationId: ctx.organizationId,
  };

  // Enforce branch scope if branch admin
  if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
    where.branchId = ctx.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  if (status) {
    where.status = status;
  }

  if (classId) {
    where.classAppliedId = classId;
  }

  if (search) {
    where.OR = [
      { studentName: { contains: search } },
      { parentName: { contains: search } },
      { parentEmail: { contains: search } },
      { parentPhone: { contains: search } },
    ];
  }

  try {
    const [inquiries, total] = await Promise.all([
      prisma.admissionInquiry.findMany({
        where,
        include: {
          classApplied: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.admissionInquiry.count({ where }),
    ]);

    return apiSuccess(inquiries, { page, limit, total });
  } catch (error) {
    console.error("List inquiries error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list inquiries", 500);
  }
}

/**
 * POST /api/v1/admissions/inquiries — Create a new admission inquiry
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "admissions", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createInquirySchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const data = parsed.data;

  // Branch Admins are locked to their own branch
  if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId && data.branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot create inquiry in another branch", 403);
  }

  try {
    // Validate branch belongs to organization
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!branch) {
      return apiError("NOT_FOUND", "Branch not found or inactive", 404);
    }

    // Validate class belongs to branch
    const cls = await prisma.class.findFirst({
      where: { id: data.classAppliedId, branchId: data.branchId },
    });
    if (!cls) {
      return apiError("NOT_FOUND", "Class not found in target branch", 404);
    }

    // Validate academic year belongs to organization
    const ay = await prisma.academicYear.findFirst({
      where: { id: data.academicYearId, organizationId: ctx.organizationId },
    });
    if (!ay) {
      return apiError("NOT_FOUND", "Academic year not found", 404);
    }

    const inquiry = await prisma.admissionInquiry.create({
      data: {
        organizationId: ctx.organizationId,
        branchId: data.branchId,
        academicYearId: data.academicYearId,
        studentName: data.studentName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        classAppliedId: data.classAppliedId,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        parentEmail: data.parentEmail,
        source: data.source,
        status: data.status,
        notes: data.notes || null,
      },
      include: {
        classApplied: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(inquiry, undefined, 201);
  } catch (error) {
    console.error("Create inquiry error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create inquiry", 500);
  }
}
