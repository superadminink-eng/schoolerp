import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { generateUniqueInvoiceNo } from "@/lib/unique-id";
import crypto from "crypto";

const promoteBulkSchema = z.object({
  studentIds: z.array(z.string()).min(1, "At least one student must be selected"),
  targetSectionId: z.string().min(1, "Target section is required"),
  targetAcademicYearId: z.string().min(1, "Target academic year is required"),
  discountPercent: z.number().min(0).max(100).default(0),
  termType: z.enum(["FULL_TERM", "HALF_TERM", "SHORT_TERM"]).optional(),
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

    const { studentIds, targetSectionId, targetAcademicYearId, discountPercent, termType } = parsed.data;

    // 1. Verify target section and class exist
    const targetSection = await prisma.section.findFirst({
      where: { id: targetSectionId },
      include: { class: true },
    });
    if (!targetSection) return apiNotFound("Target Section");

    // 2. Process promotions in a single transaction
    const results = await prisma.$transaction(async (tx) => {
      const promoted: string[] = [];
      const skipped: string[] = [];
      const generatedInvoiceNos = new Set<string>();

      for (const studentId of studentIds) {
        // Verify student exists in this tenant organization
        const student = await tx.student.findFirst({
          where: {
            id: studentId,
            organizationId: ctx.organizationId,
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

        // Resolve final term type (either parameter or current student term type)
        const currentEnrollment = await tx.studentEnrollment.findFirst({
          where: { studentId },
          orderBy: { enrolledAt: "desc" },
        });
        const finalTermType = termType || currentEnrollment?.termType || "FULL_TERM";

        // Create enrollment
        await tx.studentEnrollment.create({
          data: {
            studentId,
            academicYearId: targetAcademicYearId,
            sectionId: targetSectionId,
            rollNo: student.rollNo, // Rollover current rollNo
            termType: finalTermType,
          },
        });

        // Generate invoices matching target class fees and term type templates
        const feeStructures = await tx.feeStructure.findMany({
          where: {
            classId: targetSection.classId,
            academicYearId: targetAcademicYearId,
            termType: finalTermType,
          },
          include: { feeCategory: true },
        });

        if (feeStructures.length > 0) {
          const annualFees = feeStructures.map((fs) => {
            const base = new Prisma.Decimal(fs.amount);
            let annual = base;
            switch (fs.frequency) {
              case "MONTHLY": annual = base.mul(12); break;
              case "QUARTERLY": annual = base.mul(4); break;
              case "SEMI_ANNUAL": annual = base.mul(2); break;
              default: annual = base;
            }
            return { feeStructureId: fs.id, name: fs.feeCategory.name, annual };
          });

          const annualTotal = annualFees.reduce((acc, item) => acc.plus(item.annual), new Prisma.Decimal(0));
          const discountPct = new Prisma.Decimal(discountPercent);
          const discountMultiplier = new Prisma.Decimal(1).minus(discountPct.div(100));

          // Fetch templates for the resolved term type
          const classTemplates = await tx.feeInstallmentTemplate.findMany({
            where: {
              classId: targetSection.classId,
              academicYearId: targetAcademicYearId,
              termType: finalTermType,
            },
            orderBy: { dueDate: "asc" },
          });

          if (classTemplates.length > 0) {
            const totalTemplateAmount = classTemplates.reduce((sum, inst) => sum.plus(new Prisma.Decimal(inst.amount)), new Prisma.Decimal(0));

            for (const temp of classTemplates) {
              const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);

              const tempAmount = new Prisma.Decimal(temp.amount);
              const discountedTotal = tempAmount.mul(discountMultiplier);

              await tx.invoice.create({
                data: {
                  studentId,
                  organizationId: ctx.organizationId,
                  number: invoiceNo,
                  year: new Date().getFullYear(),
                  totalAmount: discountedTotal,
                  paidAmount: 0,
                  status: "PENDING",
                  dueDate: temp.dueDate,
                  lateFeeActive: temp.lateFeeActive,
                  lateFeeType: temp.lateFeeType,
                  lateFeeValue: temp.lateFeeValue,
                  lateFeePerDay: temp.lateFeePerDay,
                  lateFeeGrace: temp.lateFeeGrace,
                  items: {
                    create: annualFees.map((fi) => {
                      const proportionalAmount = totalTemplateAmount.gt(0)
                        ? fi.annual.mul(tempAmount.div(totalTemplateAmount)).mul(discountMultiplier)
                        : new Prisma.Decimal(0);
                      return {
                        feeStructureId: fi.feeStructureId,
                        amount: proportionalAmount,
                        description: `${fi.name} - ${temp.name}`,
                      };
                    }),
                  },
                },
              });
            }
          } else {
            const invoiceNo = await generateUniqueInvoiceNo(tx, ctx.organizationId);

            const discountedTotal = annualTotal.mul(discountMultiplier);
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            await tx.invoice.create({
              data: {
                studentId,
                organizationId: ctx.organizationId,
                number: invoiceNo,
                year: new Date().getFullYear(),
                totalAmount: discountedTotal,
                paidAmount: 0,
                status: "PENDING",
                dueDate,
                items: {
                  create: annualFees.map((fi) => ({
                    feeStructureId: fi.feeStructureId,
                    amount: fi.annual.mul(discountMultiplier),
                    description: fi.name,
                  })),
                },
              },
            });
          }
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
