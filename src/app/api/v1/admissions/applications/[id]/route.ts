import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, hasPermission } from "@/lib/rbac";
import { z } from "zod";

export const dynamic = "force-dynamic";

const editApplicationSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  bloodGroup: z.string().nullable().optional(),
  address: z.string().nullable().optional().or(z.literal("")),
  pincode: z.string().nullable().optional().or(z.literal("")),
  previousSchool: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  fatherPhone: z.string().nullable().optional(),
  fatherEmail: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  fatherOccupation: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  motherPhone: z.string().nullable().optional(),
  motherEmail: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  motherOccupation: z.string().nullable().optional(),
  classId: z.string(),
});

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return PATCH(req, ctx);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  
  const ctx = getTenantContext(req);
  const isSuperOrSchoolAdmin = ctx.roleName === "SUPER_ADMIN" || ctx.roleName === "SCHOOL_ADMIN";
  let allowed = isSuperOrSchoolAdmin;
  if (!allowed) {
    const [hasVerify, hasExam, hasRegistrar] = await Promise.all([
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "document_verification"),
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "entrance_exam"),
      hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "registrar_desk"),
    ]);
    allowed = hasVerify || hasExam || hasRegistrar;
  }

  if (!allowed) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }

  try {
    const existingWhere: Record<string, unknown> = {
      id: resolvedParams.id,
      organizationId: ctx.organizationId,
    };

    if (!isSuperOrSchoolAdmin && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const application = await prisma.admissionApplication.findFirst({
      where: existingWhere,
      include: {
        documents: true,
        examResult: true,
        class: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true, hasEntranceTest: true } },
      }
    });

    if (!application) {
      return apiError("NOT_FOUND", "Application not found", 404);
    }

    return apiSuccess(application);
  } catch (error) {
    console.error("Fetch application error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch application", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  
  // We use registrar_desk permission for editing applications in progress
  const denied = await checkApiPermission(req, "admissions", "registrar_desk");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = editApplicationSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.errors.map((e) => e.message).join(", ");
    return apiError("VALIDATION_ERROR", errorMsg, 400);
  }

  const data = parsed.data;

  try {
    const existingWhere: Record<string, unknown> = {
      id: resolvedParams.id,
      organizationId: ctx.organizationId,
    };

    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.admissionApplication.findFirst({
      where: existingWhere,
      include: { class: true }
    });

    if (!existing) return apiError("NOT_FOUND", "Application not found", 404);

    // If changing class, verify the new class belongs to the branch
    if (data.classId !== existing.classId) {
      const cls = await prisma.class.findFirst({
        where: { id: data.classId, branchId: existing.branchId, status: "ACTIVE" },
      });
      if (!cls) {
        return apiError("BAD_REQUEST", "Invalid Class for this branch", 400);
      }
    }

    // Clean empty strings to null for optional emails
    const fEmail = data.fatherEmail === "" ? null : data.fatherEmail;
    const mEmail = data.motherEmail === "" ? null : data.motherEmail;

    const updated = await prisma.admissionApplication.update({
      where: { id: resolvedParams.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender as any,
        bloodGroup: data.bloodGroup || null,
        address: data.address,
        pincode: data.pincode,
        previousSchool: data.previousSchool || null,
        emergencyContact: data.emergencyContact || null,
        fatherName: data.fatherName || null,
        fatherPhone: data.fatherPhone || null,
        fatherEmail: fEmail,
        fatherOccupation: data.fatherOccupation || null,
        motherName: data.motherName || null,
        motherPhone: data.motherPhone || null,
        motherEmail: mEmail,
        motherOccupation: data.motherOccupation || null,
        classId: data.classId,
      },
      include: {
        class: true,
        academicYear: true,
      }
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Edit application error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update application", 500);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const ctx = getTenantContext(req);

  try {
    const existingWhere: Record<string, unknown> = {
      id: resolvedParams.id,
      organizationId: ctx.organizationId,
    };

    if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const application = await prisma.admissionApplication.findFirst({
      where: existingWhere,
      include: {
        academicYear: true,
        class: true,
        branch: true,
        documents: true,
        examResult: true,
        tokens: true
      }
    });

    if (!application) return apiError("NOT_FOUND", "Application not found", 404);

    return apiSuccess(application);
  } catch (error) {
    console.error("Fetch application error:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch application", 500);
  }
}
