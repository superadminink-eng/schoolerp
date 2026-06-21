import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiNotFound,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";
import { updateClassSchema } from "@/lib/validations/class";

type RouteContext = { params: Promise<{ id: string }> };

const classIncludes = {
  subjects: {
    orderBy: { name: "asc" as const },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      subjectMasterId: true,
    },
  },
  sections: {
    where: { deletedAt: null },
    orderBy: { name: "asc" as const },
    include: {
      classTeacher: { select: { id: true, name: true, deletedAt: true } },
      sectionSubjectTeachers: {
        where: { staff: { deletedAt: null } },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          staff: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          studentEnrollments: {
            where: {
              student: {
                status: "ACTIVE" as any
              }
            }
          }
        },
      },
    },
  },
  feeStructures: {
    include: { feeCategory: { select: { name: true } } },
  },
  feeInstallmentTemplates: {
    orderBy: { dueDate: "asc" as const },
  },
  branch: { select: { id: true, name: true } },
  academicYear: { select: { id: true, name: true } },
};

/**
 * GET /api/v1/classes/:id — get a single class with full details
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "classes", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const classRecord = await prisma.class.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
      },
      include: classIncludes,
    });

    if (!classRecord) return apiNotFound("Class");

    const invoiceCount = await prisma.invoiceItem.count({
      where: { feeStructure: { classId: id } }
    });
    const hasInvoices = invoiceCount > 0;

    return apiSuccess({
      ...classRecord,
      hasInvoices,
    });
  } catch (error) {
    console.error("Get class error:", error);
    return apiError("INTERNAL_ERROR", "Failed to get class", 500);
  }
}

/**
 * PATCH /api/v1/classes/:id — update a class, sync subjects, sections, and fees
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "classes", "update");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = updateClassSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  try {
    const existing = await prisma.class.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
      },
      include: {
        subjects: true,
        sections: {
          where: { deletedAt: null },
          include: {
            sectionSubjectTeachers: {
              where: { staff: { deletedAt: null } },
            },
          },
        },
        feeStructures: {
          include: { feeCategory: { select: { name: true } } },
        },
        feeInstallmentTemplates: true,
      },
    });

    if (!existing) return apiNotFound("Class");

    const { name, numericGrade, subjects, sections, fees, installments, status } = parsed.data;

    if (existing.status === "ACTIVE" && status === "DRAFT") {
      return apiError("BAD_REQUEST", "Active class cannot be set back to draft mode", 400);
    }

    const enrollmentCount = await prisma.studentEnrollment.count({
      where: { section: { classId: id } },
    });

    // Smart lock validation
    if (enrollmentCount > 0) {
      if (numericGrade !== undefined && numericGrade !== existing.numericGrade) {
        return apiError("CONFLICT", "Cannot modify numeric grade when students are enrolled", 409);
      }

      if (sections !== undefined) {
        const existingIds = existing.sections.map(s => s.id);
        const incomingIds = sections.map(s => s.id).filter(Boolean);
        const deletedIds = existingIds.filter(eid => !incomingIds.includes(eid));
        
        if (deletedIds.length > 0) {
          for (const deletedId of deletedIds) {
            const activeCount = await prisma.studentEnrollment.count({
              where: {
                sectionId: deletedId,
                student: { status: "ACTIVE" as any }
              }
            });
            if (activeCount > 0) {
              return apiError("CONFLICT", "Cannot delete a division that has active enrolled students", 409);
            }
          }
        }
      }
    }

    // Smart billing lock validation: block base fee/installment amount edits only if invoices exist.
    const invoiceCount = await prisma.invoiceItem.count({
      where: { feeStructure: { classId: id } }
    });
    const hasInvoices = invoiceCount > 0;

    if (hasInvoices) {
      if (fees !== undefined) {
        if (fees.length !== existing.feeStructures.length) {
          return apiError("CONFLICT", "Cannot add or remove fee structures when invoices have been generated", 409);
        }
        for (const fee of fees) {
          if (fee.id) {
            const existFee = existing.feeStructures.find(f => f.id === fee.id);
            if (!existFee || Number(existFee.amount) !== Number(fee.amount) || existFee.feeCategory.name !== fee.name) {
              return apiError("CONFLICT", "Cannot modify fee structure amounts or names when invoices have been generated", 409);
            }
          } else {
            return apiError("CONFLICT", "Cannot add new fee structures when invoices have been generated", 409);
          }
        }
      }

      if (installments !== undefined) {
        if (installments.length !== existing.feeInstallmentTemplates.length) {
          return apiError("CONFLICT", "Cannot add or remove installments when invoices have been generated", 409);
        }
        for (let i = 0; i < installments.length; i++) {
          const incoming = installments[i];
          let match = existing.feeInstallmentTemplates.find(t => t.id === incoming.id);
          if (!match) {
            match = existing.feeInstallmentTemplates[i];
          }
          if (!match || Number(match.amount) !== Number(incoming.amount) || match.termType !== incoming.termType) {
            return apiError("CONFLICT", "Cannot modify installment amounts or term types when invoices have been generated", 409);
          }
        }
      }
    }

    // Enforce sum match for each term type individually if provided or updated
    if (fees !== undefined || installments !== undefined) {
      const finalFees = fees !== undefined ? fees : existing.feeStructures.map(f => ({
        name: f.feeCategory.name,
        amount: Number(f.amount),
        termType: f.termType,
      }));
      
      const finalInstallments = installments !== undefined ? installments : existing.feeInstallmentTemplates;

      const termTypes = ["FULL_TERM", "HALF_TERM", "SHORT_TERM"] as const;
      for (const t of termTypes) {
        const termFees = finalFees.filter(f => f.termType === t);
        const termInstallments = finalInstallments.filter(i => i.termType === t);
        
        if (termFees.length > 0 || termInstallments.length > 0) {
          const totalTermFees = termFees.reduce(
            (sum, f) => sum.plus(new Prisma.Decimal(f.amount)),
            new Prisma.Decimal(0)
          );
          const totalTermInstallments = termInstallments.reduce(
            (sum, i) => sum.plus(new Prisma.Decimal(i.amount)),
            new Prisma.Decimal(0)
          );
          
          if (!totalTermFees.equals(totalTermInstallments)) {
            const termLabel = t === "FULL_TERM" ? "Full Term" : t === "HALF_TERM" ? "Half Term" : "Short Term";
            return apiError(
              "BAD_REQUEST",
              `The sum of ${termLabel} installments (₹${totalTermInstallments.toNumber().toLocaleString("en-IN")}) must equal the total ${termLabel} fee amount (₹${totalTermFees.toNumber().toLocaleString("en-IN")}).`,
              400
            );
          }
        }
      }
    }

    // Verify all staff IDs assigned as teachers belong to organization
    if (sections !== undefined) {
      const staffIdsToVerify = new Set<string>();
      for (const sec of sections) {
        if (sec.classTeacherId) staffIdsToVerify.add(sec.classTeacherId);
        for (const st of sec.subjectTeachers) {
          if (st.staffId) staffIdsToVerify.add(st.staffId);
        }
      }

      if (staffIdsToVerify.size > 0) {
        const verifiedStaffCount = await prisma.staff.count({
          where: {
            id: { in: Array.from(staffIdsToVerify) },
            organizationId: ctx.organizationId,
          },
        });
        if (verifiedStaffCount !== staffIdsToVerify.size) {
          return apiError(
            "FORBIDDEN",
            "One or more assigned staff members do not belong to your organization",
            403
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update basic class fields
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (numericGrade !== undefined) data.numericGrade = numericGrade;
      if (status !== undefined) data.status = status;

      if (Object.keys(data).length > 0) {
        await tx.class.update({ where: { id }, data });
      }

      // Track the final ordered list of subject IDs for section teacher indexing
      let resolvedSubjectIds: string[] = existing.subjects.map((s) => s.id);

      // Sync subjects
      if (subjects !== undefined) {
        const incomingKeepIds: string[] = [];
        const newMasterIds: string[] = [];

        for (const entry of subjects) {
          if ("id" in entry) {
            incomingKeepIds.push(entry.id);
          } else {
            newMasterIds.push(entry.subjectMasterId);
          }
        }

        const existingSubjectIds = existing.subjects.map((s) => s.id);
        const toRemove = existingSubjectIds.filter(
          (eid) => !incomingKeepIds.includes(eid)
        );

        // Check if subjects to remove have exam or timetable references
        if (toRemove.length > 0) {
          const examRefCount = await tx.examSubject.count({
            where: { subjectId: { in: toRemove } },
          });
          if (examRefCount > 0) {
            throw new Error(
              "CONFLICT:Cannot remove subjects that have exam references"
            );
          }
          const ttRefCount = await tx.timetableSlot.count({
            where: { subjectId: { in: toRemove } },
          });
          if (ttRefCount > 0) {
            throw new Error(
              "CONFLICT:Cannot remove subjects that have timetable references"
            );
          }

          // Delete section-subject-teacher entries for removed subjects
          await tx.sectionSubjectTeacher.deleteMany({
            where: { subjectId: { in: toRemove } },
          });

          await tx.subject.deleteMany({
            where: { id: { in: toRemove } },
          });
        }

        // Add new subjects from masters
        const newSubjectIds: string[] = [];
        if (newMasterIds.length > 0) {
          const masters = await tx.subjectMaster.findMany({
            where: {
              id: { in: newMasterIds },
              organizationId: ctx.organizationId,
            },
          });

          for (const masterId of newMasterIds) {
            const master = masters.find((m) => m.id === masterId);
            if (!master) continue;

            // Check if this code already exists for the class
            const existingCode = await tx.subject.findFirst({
              where: { classId: id, code: master.code },
            });
            if (existingCode) {
              // Skip duplicate codes
              newSubjectIds.push(existingCode.id);
              continue;
            }

            const subject = await tx.subject.create({
              data: {
                classId: id,
                subjectMasterId: master.id,
                name: master.name,
                code: master.code,
                type: master.type,
              },
            });
            newSubjectIds.push(subject.id);
          }
        }

        // Build final ordered subject IDs based on the incoming subjects array order
        resolvedSubjectIds = [];
        for (const entry of subjects) {
          if ("id" in entry) {
            resolvedSubjectIds.push(entry.id);
          } else {
            const newId = newSubjectIds.shift();
            if (newId) resolvedSubjectIds.push(newId);
          }
        }
      }

      // Sync sections
      if (sections !== undefined) {
        const incomingIds = sections
          .map((s) => s.id)
          .filter((sid): sid is string => !!sid);
        const existingIds = existing.sections.map((s) => s.id);
        const toRemove = existingIds.filter((eid) => !incomingIds.includes(eid));

        // Check if any sections to remove have active student enrollments
        if (toRemove.length > 0) {
          for (const secId of toRemove) {
            const activeCount = await tx.studentEnrollment.count({
              where: {
                sectionId: secId,
                student: { status: "ACTIVE" as any }
              }
            });
            if (activeCount > 0) {
              throw new Error("CONFLICT:Cannot delete a division that has active enrolled students");
            }
          }
          await tx.section.deleteMany({ where: { id: { in: toRemove } } });
        }

        for (const section of sections) {
          let sectionId: string;

          if (section.id && existingIds.includes(section.id)) {
            // Update existing section
            await tx.section.update({
              where: { id: section.id },
              data: {
                name: section.name,
                classTeacherId: section.classTeacherId || null,
              },
            });
            sectionId = section.id;
          } else {
            // Create new section
            const created = await tx.section.create({
              data: {
                classId: id,
                name: section.name,
                classTeacherId: section.classTeacherId || null,
              },
            });
            sectionId = created.id;
          }

          // Replace section-subject-teacher records
          await tx.sectionSubjectTeacher.deleteMany({
            where: { sectionId },
          });

          for (const st of section.subjectTeachers) {
            if (
              st.subjectIndex >= 0 &&
              st.subjectIndex < resolvedSubjectIds.length
            ) {
              await tx.sectionSubjectTeacher.create({
                data: {
                  sectionId,
                  subjectId: resolvedSubjectIds[st.subjectIndex],
                  staffId: st.staffId,
                },
              });
            }
          }
        }
      }

      // Sync fees
      if (fees !== undefined) {
        const incomingFeeIds = fees
          .map((f) => f.id)
          .filter((fid): fid is string => !!fid);
        const existingFeeIds = existing.feeStructures.map((f) => f.id);
        const feesToRemove = existingFeeIds.filter(
          (eid) => !incomingFeeIds.includes(eid)
        );

        if (feesToRemove.length > 0) {
          const invoiceItemCount = await tx.invoiceItem.count({
            where: { feeStructureId: { in: feesToRemove } },
          });
          if (invoiceItemCount > 0) {
            throw new Error(
              "CONFLICT:Cannot remove fees that have invoice items"
            );
          }
          await tx.feeStructure.deleteMany({
            where: { id: { in: feesToRemove } },
          });
        }

        for (const fee of fees) {
          const feeCategory = await tx.feeCategory.upsert({
            where: {
              organizationId_name: {
                organizationId: ctx.organizationId,
                name: fee.name,
              },
            },
            update: {},
            create: {
              organizationId: ctx.organizationId,
              name: fee.name,
            },
          });

          if (fee.id && existingFeeIds.includes(fee.id)) {
            await tx.feeStructure.update({
              where: { id: fee.id },
              data: {
                feeCategoryId: feeCategory.id,
                amount: fee.amount,
                frequency: "ANNUAL",
                termType: fee.termType,
              },
            });
          } else {
            await tx.feeStructure.create({
              data: {
                classId: id,
                academicYearId: existing.academicYearId,
                feeCategoryId: feeCategory.id,
                amount: fee.amount,
                frequency: "ANNUAL",
                termType: fee.termType,
              },
            });
          }
        }
      }

      // Sync installments
      if (installments !== undefined) {
        // Delete all old templates
        await tx.feeInstallmentTemplate.deleteMany({
          where: { classId: id },
        });

        // Create new templates
        for (const inst of installments) {
          await tx.feeInstallmentTemplate.create({
            data: {
              classId: id,
              academicYearId: existing.academicYearId,
              name: inst.name,
              amount: inst.amount,
              dueDate: new Date(inst.dueDate),
              termType: inst.termType,
              lateFeeActive: inst.lateFeeActive,
              lateFeeType: inst.lateFeeType,
              lateFeeValue: inst.lateFeeValue,
              lateFeePerDay: inst.lateFeePerDay,
              lateFeeGrace: inst.lateFeeGrace,
            },
          });
        }
      }
    }, { timeout: 30000 });

    // Refetch updated class
    const updated = await prisma.class.findUnique({
      where: { id },
      include: classIncludes,
    });

    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CONFLICT:")) {
      return apiError("CONFLICT", error.message.slice(9), 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(", ");
      return apiError("CONFLICT", `A division or configuration with these details already exists.`, 409);
    }
    console.error("Update class error:", error);
    return apiError("INTERNAL_ERROR", "Failed to update class", 500);
  }
}

/**
 * DELETE /api/v1/classes/:id — delete a class
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "classes", "delete");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await context.params;

  try {
    const existing = await prisma.class.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
      },
    });

    if (!existing) return apiNotFound("Class");

    // Check enrollment count
    const enrollmentCount = await prisma.studentEnrollment.count({
      where: { section: { classId: id } },
    });
    if (enrollmentCount > 0) {
      return apiError(
        "CONFLICT",
        `Cannot delete: ${enrollmentCount} student${enrollmentCount > 1 ? "s" : ""} enrolled in this class`,
        409
      );
    }

    // Cascade deletes sections + subjects + fee structures via Prisma onDelete: Cascade
    await prisma.class.delete({ where: { id } });

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    console.error("Delete class error:", error);
    return apiError("INTERNAL_ERROR", "Failed to delete class", 500);
  }
}
