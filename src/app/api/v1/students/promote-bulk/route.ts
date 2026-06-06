import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

const promoteBulkSchema = z.object({
  studentIds: z.array(z.string()).min(1, "At least one student must be selected"),
  targetSectionId: z.string().min(1, "Target section is required"),
  targetAcademicYearId: z.string().min(1, "Target academic year is required"),
  discountPercent: z.number().min(0).max(100).default(0),
});

/**
 * POST /api/v1/students/promote-bulk — Bulk promote students to next class/section
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "students", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  try {
    const body = await req.json();
    const parsed = promoteBulkSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { studentIds, targetSectionId, targetAcademicYearId, discountPercent } = parsed.data;

    // 1. Verify target section and class exist
    const targetSection = await prisma.section.findFirst({
      where: { id: targetSectionId },
      include: { class: true },
    });
    if (!targetSection) return apiNotFound("Target Section");

    // 2. Fetch fee structures for the target class and academic year
    const feeStructures = await prisma.feeStructure.findMany({
      where: {
        classId: targetSection.classId,
        academicYearId: targetAcademicYearId,
      },
      include: { feeCategory: true },
    });

    // Compute annual fee items if structures exist
    const feeItems = feeStructures.map((fs) => {
      const base = Number(fs.amount);
      let annual = base;
      switch (fs.frequency) {
        case "MONTHLY":
          annual = base * 12;
          break;
        case "QUARTERLY":
          annual = base * 4;
          break;
        case "SEMI_ANNUAL":
          annual = base * 2;
          break;
      }
      return {
        feeStructureId: fs.id,
        name: fs.feeCategory.name,
        amount: annual * (1 - discountPercent / 100),
      };
    });

    const totalAmount = feeItems.reduce((acc, item) => acc + item.amount, 0);

    // 3. Process promotions in a single transaction
    const results = await prisma.$transaction(async (tx) => {
      const promoted: string[] = [];
      const skipped: string[] = [];

      for (const studentId of studentIds) {
        // Verify student exists in this tenant organization
        const student = await tx.student.findFirst({
          where: {
            id: studentId,
            branch: { organizationId: ctx.organizationId },
          },
        });

        if (!student) {
          skipped.push(studentId);
          continue;
        }

        // Check if student is already enrolled in this target academic year
        const existingEnrollment = await tx.studentEnrollment.findUnique({
          where: {
            studentId_academicYearId: {
              studentId,
              academicYearId: targetAcademicYearId,
            },
          },
        });

        if (existingEnrollment) {
          skipped.push(studentId);
          continue;
        }

        // Create enrollment
        await tx.studentEnrollment.create({
          data: {
            studentId,
            academicYearId: targetAcademicYearId,
            sectionId: targetSectionId,
            rollNo: student.rollNo, // Rollover current rollNo
          },
        });

        // Generate invoice if target class has fees
        if (totalAmount > 0) {
          const invoiceNo = `INV-PROMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30); // 30 days due date

          await tx.invoice.create({
            data: {
              studentId,
              number: invoiceNo,
              year: new Date().getFullYear(),
              totalAmount,
              paidAmount: 0,
              status: "PENDING",
              dueDate,
              items: {
                create: feeItems.map((fi) => ({
                  feeStructureId: fi.feeStructureId,
                  amount: fi.amount,
                  description: fi.name,
                })),
              },
            },
          });
        }

        promoted.push(studentId);
      }

      return { promoted, skipped };
    });

    return apiSuccess({
      message: `Successfully promoted ${results.promoted.length} students.`,
      promotedCount: results.promoted.length,
      skippedCount: results.skipped.length,
      promotedIds: results.promoted,
      skippedIds: results.skipped,
    });
  } catch (error) {
    console.error("Bulk promotion error:", error);
    return apiError("INTERNAL_ERROR", "Failed to process bulk promotion", 500);
  }
}
