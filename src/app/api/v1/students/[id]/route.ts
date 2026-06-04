import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateStudentSchema } from "@/lib/validations/student";
import { saveUploadedImage, deleteUploadedFile, UploadError } from "@/lib/upload";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/students/:id — get a single student
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "students", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  const where: Record<string, unknown> = {
    id,
    branch: { organizationId: ctx.organizationId },
  };

  if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
    where.branchId = ctx.branchId;
  }

  try {
    const student = await prisma.student.findFirst({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        rollNo: true,
        dateOfBirth: true,
        gender: true,
        bloodGroup: true,
        photo: true,
        address: true,
        pincode: true,
        previousSchool: true,
        emergencyContact1: true,
        emergencyContact2: true,
        idType: true,
        idNumber: true,
        idDocument: true,
        guardianName: true,
        fatherName: true,
        fatherPhone: true,
        fatherEmail: true,
        fatherOccupation: true,
        motherName: true,
        motherPhone: true,
        motherEmail: true,
        motherOccupation: true,
        admissionDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
        enrollments: {
          orderBy: { enrolledAt: "desc" },
          select: {
            id: true,
            rollNo: true,
            enrolledAt: true,
            academicYear: { select: { id: true, name: true } },
            section: {
              select: {
                id: true,
                name: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!student) return apiNotFound("Student");

    // Compute fee totals for this student
    const invoiceAgg = await prisma.invoice.aggregate({
      where: { studentId: student.id, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true, paidAmount: true },
    });

    const totalFees = Number(invoiceAgg._sum.totalAmount ?? 0);
    const totalFeesPaid = Number(invoiceAgg._sum.paidAmount ?? 0);

    // Derive classId from enrollment or invoice fee structures
    let classId: string | null = student.enrollments?.[0]?.section?.class?.id ?? null;
    if (!classId) {
      const invoiceItem = await prisma.invoiceItem.findFirst({
        where: { invoice: { studentId: student.id } },
        select: { feeStructure: { select: { classId: true } } },
      });
      if (invoiceItem) {
        classId = invoiceItem.feeStructure.classId;
      }
    }

    return apiSuccess({
      ...student,
      classId,
      totalFees,
      totalFeesPaid,
      pendingFees: totalFees - totalFeesPaid,
    });
  } catch (error) {
    console.error("Get student error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get student", 500);
  }
}

/**
 * PATCH /api/v1/students/:id — update a student
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "students", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  // Accept both FormData (with files) and JSON
  let fields: Record<string, string> = {};
  let formData: FormData | null = null;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          fields[key] = value;
        }
      }
    } else {
      fields = await req.json();
    }
  } catch {
    return apiError("BAD_REQUEST", "Invalid request body", 400);
  }

  const parsed = updateStudentSchema.safeParse(fields);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existingWhere: Record<string, unknown> = {
      id,
      branch: { organizationId: ctx.organizationId },
    };

    if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.student.findFirst({ where: existingWhere });
    if (!existing) return apiNotFound("Student");

    const {
      firstName, lastName, dateOfBirth, gender, bloodGroup, address, pincode,
      previousSchool, emergencyContact1, emergencyContact2, idType, idNumber,
      guardianName, fatherName, fatherPhone, fatherEmail, fatherOccupation,
      motherName, motherPhone, motherEmail, motherOccupation, admissionDate,
      branchId, sectionId, status,
    } = parsed.data;

    // If changing branch, verify it belongs to org
    if (branchId && branchId !== "" && branchId !== existing.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId: ctx.organizationId, isActive: true },
      });
      if (!branch) {
        return apiError("NOT_FOUND", "Branch not found", 404);
      }
    }

    // Handle file uploads
    let photoPath: string | undefined;
    let idDocumentPath: string | undefined;
    if (formData) {
      const photoFile = formData.get("photo");
      if (photoFile instanceof File && photoFile.size > 0) {
        try {
          const result = await saveUploadedImage(
            photoFile, "uploads/student-photos", existing.admissionNo, "photo"
          );
          photoPath = result.filePath;
          if (existing.photo) {
            await deleteUploadedFile(existing.photo);
          }
        } catch (error) {
          if (error instanceof UploadError) {
            return apiError("VALIDATION_ERROR", `Photo: ${error.message}`, 422);
          }
          throw error;
        }
      }

      const idDocFile = formData.get("idDocument");
      if (idDocFile instanceof File && idDocFile.size > 0) {
        try {
          const result = await saveUploadedImage(
            idDocFile, "uploads/student-documents", existing.admissionNo
          );
          idDocumentPath = result.filePath;
          if (existing.idDocument) {
            await deleteUploadedFile(existing.idDocument);
          }
        } catch (error) {
          if (error instanceof UploadError) {
            return apiError("VALIDATION_ERROR", `ID Document: ${error.message}`, 422);
          }
          throw error;
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
    if (gender !== undefined) data.gender = gender;
    if (bloodGroup !== undefined) data.bloodGroup = bloodGroup || null;
    if (address !== undefined) data.address = address || null;
    if (pincode !== undefined) data.pincode = pincode || null;
    if (previousSchool !== undefined) data.previousSchool = previousSchool || null;
    if (emergencyContact1 !== undefined) data.emergencyContact1 = emergencyContact1 || null;
    if (emergencyContact2 !== undefined) data.emergencyContact2 = emergencyContact2 || null;
    if (idType !== undefined) data.idType = idType || null;
    if (idNumber !== undefined) data.idNumber = idNumber || null;
    if (guardianName !== undefined) data.guardianName = guardianName || null;
    if (fatherName !== undefined) data.fatherName = fatherName || null;
    if (fatherPhone !== undefined) data.fatherPhone = fatherPhone || null;
    if (fatherEmail !== undefined) data.fatherEmail = fatherEmail || null;
    if (fatherOccupation !== undefined) data.fatherOccupation = fatherOccupation || null;
    if (motherName !== undefined) data.motherName = motherName || null;
    if (motherPhone !== undefined) data.motherPhone = motherPhone || null;
    if (motherEmail !== undefined) data.motherEmail = motherEmail || null;
    if (motherOccupation !== undefined) data.motherOccupation = motherOccupation || null;
    if (admissionDate !== undefined) data.admissionDate = admissionDate ? new Date(admissionDate) : undefined;
    if (branchId !== undefined && branchId !== "") data.branchId = branchId;
    if (status !== undefined) data.status = status;
    if (photoPath !== undefined) data.photo = photoPath;
    if (idDocumentPath !== undefined) data.idDocument = idDocumentPath;

    // Handle section change — update or create enrollment
    if (sectionId && sectionId !== "") {
      const section = await prisma.section.findFirst({
        where: { id: sectionId },
        include: { class: true },
      });
      if (!section) {
        return apiError("NOT_FOUND", "Section not found", 404);
      }

      const latestEnrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId: id },
        orderBy: { enrolledAt: "desc" },
      });
      if (latestEnrollment) {
        await prisma.studentEnrollment.update({
          where: { id: latestEnrollment.id },
          data: { sectionId },
        });
      } else {
        // No enrollment exists — create one
        await prisma.studentEnrollment.create({
          data: {
            studentId: id,
            sectionId,
            academicYearId: section.class.academicYearId,
          },
        });
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        dateOfBirth: true,
        gender: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(student);
  } catch (error) {
    console.error("Update student error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update student", 500);
  }
}

/**
 * DELETE /api/v1/students/:id — soft-delete (set status to DROPPED)
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "students", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existingWhere: Record<string, unknown> = {
      id,
      branch: { organizationId: ctx.organizationId },
    };

    if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
      existingWhere.branchId = ctx.branchId;
    }

    const existing = await prisma.student.findFirst({ where: existingWhere });
    if (!existing) return apiNotFound("Student");

    await prisma.student.update({
      where: { id },
      data: { status: "DROPPED" },
    });

    return apiSuccess({ id, dropped: true });
  } catch (error) {
    console.error("Delete student error:", error);
    return apiError("INTERNAL_ERROR", "Failed to drop student", 500);
  }
}
