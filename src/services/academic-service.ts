import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { TenantContext } from "./fee-service";

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
    include: { feeCategory: { select: { id: true, name: true } } },
  },
  feeInstallmentTemplates: {
    orderBy: { dueDate: "asc" as const },
  },
  branch: { select: { id: true, name: true } },
  academicYear: { select: { id: true, name: true } },
};

export class AcademicService {
  /**
   * Deletes a Class record, checking if there are active student enrollments first.
   */
  static async deleteClass(id: string, ctx: TenantContext) {
    const existing = await prisma.class.findFirst({
      where: {
        id,
        organizationId: ctx.organizationId,
      },
    });

    if (!existing) {
      throw new Error("CLASS_NOT_FOUND");
    }

    const enrollmentCount = await prisma.studentEnrollment.count({
      where: { section: { classId: id } },
    });

    if (enrollmentCount > 0) {
      throw new Error(`CONFLICT:Cannot delete: ${enrollmentCount} student(s) enrolled in this class`);
    }

    // Cascade soft-deletes sections via explicit update transaction
    await prisma.$transaction(async (tx) => {
      await tx.section.updateMany({
        where: { classId: id },
        data: { deletedAt: new Date() },
      });
      await tx.class.delete({ where: { id } });
    });

    return { id, deleted: true };
  }

  /**
   * Updates a class, syncing child sections, subject mappings, fee structures, and installment templates.
   */
  static async updateClass(id: string, data: any, ctx: TenantContext) {
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
          include: { feeCategory: { select: { id: true, name: true } } },
        },
        feeInstallmentTemplates: true,
      },
    });

    if (!existing) {
      throw new Error("CLASS_NOT_FOUND");
    }

    const { name, numericGrade, subjects, sections, fees, installments, status } = data;

    if (existing.status === "ACTIVE" && status === "DRAFT") {
      throw new Error("BAD_REQUEST:Active class cannot be set back to draft mode");
    }

    const enrollmentCount = await prisma.studentEnrollment.count({
      where: { section: { classId: id } },
    });

    // Grade and section deletion locks
    if (enrollmentCount > 0) {
      if (numericGrade !== undefined && numericGrade !== existing.numericGrade) {
        throw new Error("CONFLICT:Cannot modify numeric grade when students are enrolled");
      }

      if (sections !== undefined) {
        const existingIds = existing.sections.map(s => s.id);
        const incomingIds = sections.map((s: any) => s.id).filter(Boolean);
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
              throw new Error("CONFLICT:Cannot delete a division that has active enrolled students");
            }
          }
        }
      }
    }

    // Billing locks check
    const invoiceCount = await prisma.invoiceItem.count({
      where: { feeStructure: { classId: id } }
    });
    const hasInvoices = invoiceCount > 0;

    if (hasInvoices) {
      if (fees !== undefined) {
        if (fees.length !== existing.feeStructures.length) {
          throw new Error("CONFLICT:Cannot add or remove fee structures when invoices have been generated");
        }
        for (const fee of fees) {
          if (fee.id) {
            const existFee = existing.feeStructures.find(f => f.id === fee.id);
            if (!existFee || Number(existFee.amount) !== Number(fee.amount) || existFee.feeCategory.id !== fee.feeCategoryId) {
              throw new Error("CONFLICT:Cannot modify fee structure amounts or categories when invoices have been generated");
            }
          } else {
            throw new Error("CONFLICT:Cannot add new fee structures when invoices have been generated");
          }
        }
      }

      if (installments !== undefined) {
        if (installments.length !== existing.feeInstallmentTemplates.length) {
          throw new Error("CONFLICT:Cannot add or remove installments when invoices have been generated");
        }
        for (const inst of installments) {
          if (inst.id) {
            const existInst = existing.feeInstallmentTemplates.find(i => i.id === inst.id);
            if (!existInst || Number(existInst.amount) !== Number(inst.amount) || existInst.name !== inst.name) {
              throw new Error("CONFLICT:Cannot modify installment templates when invoices have been generated");
            }
          } else {
            throw new Error("CONFLICT:Cannot add new installments when invoices have been generated");
          }
        }
      }
    }

    // Sync in a single transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update basic fields
      await tx.class.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(numericGrade !== undefined && { numericGrade }),
          ...(status && { status }),
        },
      });

      // 2. Sync subjects
      let resolvedSubjectIds: string[] = [];
      if (subjects !== undefined) {
        // Collect existing subjects that were kept
        const incomingSubjectIds = subjects
          .map((s: any) => s.id)
          .filter((sid: any): sid is string => !!sid);
        
        const existingSubjectIds = existing.subjects.map((s) => s.id);
        const subjectsToRemove = existingSubjectIds.filter((eid) => !incomingSubjectIds.includes(eid));

        // Delete removed subjects
        if (subjectsToRemove.length > 0) {
          await tx.subject.deleteMany({
            where: { id: { in: subjectsToRemove } },
          });
        }

        // Create new subjects from SubjectMaster reference
        const incomingNewSubjectMasterIds = subjects
          .filter((s: any) => !s.id)
          .map((s: any) => s.subjectMasterId);

        const newSubjectIds: string[] = [];
        if (incomingNewSubjectMasterIds.length > 0) {
          const masters = await tx.subjectMaster.findMany({
            where: { id: { in: incomingNewSubjectMasterIds } },
          });

          for (const masterId of incomingNewSubjectMasterIds) {
            const master = masters.find((m) => m.id === masterId);
            if (!master) continue;

            const existingCode = await tx.subject.findFirst({
              where: { classId: id, code: master.code },
            });
            if (existingCode) {
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

        // Build ordered resolved list
        for (const entry of subjects) {
          if ("id" in entry) {
            resolvedSubjectIds.push(entry.id);
          } else {
            const newId = newSubjectIds.shift();
            if (newId) resolvedSubjectIds.push(newId);
          }
        }
      } else {
        resolvedSubjectIds = existing.subjects.map(s => s.id);
      }

      // 3. Sync sections
      if (sections !== undefined) {
        const incomingIds = sections
          .map((s: any) => s.id)
          .filter((sid: any): sid is string => !!sid);
        const existingIds = existing.sections.map((s) => s.id);
        const toRemove = existingIds.filter((eid) => !incomingIds.includes(eid));

        // Delete removed sections (verified empty of active students earlier)
        if (toRemove.length > 0) {
          await tx.section.deleteMany({ where: { id: { in: toRemove } } });
        }

        for (const section of sections) {
          let sectionId: string;

          if (section.id && existingIds.includes(section.id)) {
            await tx.section.update({
              where: { id: section.id },
              data: {
                name: section.name,
                classTeacherId: section.classTeacherId || null,
              },
            });
            sectionId = section.id;
          } else {
            const created = await tx.section.create({
              data: {
                classId: id,
                name: section.name,
                classTeacherId: section.classTeacherId || null,
              },
            });
            sectionId = created.id;
          }

          // Sync section-subject-teacher mappings
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

      // 4. Sync fees
      if (fees !== undefined) {
        const incomingFeeIds = fees
          .map((f: any) => f.id)
          .filter((fid: any): fid is string => !!fid);
        const existingFeeIds = existing.feeStructures.map((f) => f.id);
        const feesToRemove = existingFeeIds.filter(
          (eid) => !incomingFeeIds.includes(eid)
        );

        if (feesToRemove.length > 0) {
          await tx.feeStructure.deleteMany({
            where: { id: { in: feesToRemove } },
          });
        }

        for (const fee of fees) {
          if (fee.id && existingFeeIds.includes(fee.id)) {
            await tx.feeStructure.update({
              where: { id: fee.id },
              data: {
                feeCategoryId: fee.feeCategoryId,
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
                feeCategoryId: fee.feeCategoryId,
                amount: fee.amount,
                frequency: "ANNUAL",
                termType: fee.termType,
              },
            });
          }
        }
      }

      // 5. Sync installments
      if (installments !== undefined) {
        await tx.feeInstallmentTemplate.deleteMany({
          where: { classId: id },
        });

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

    const updated = await prisma.class.findUnique({
      where: { id },
      include: classIncludes,
    });

    return updated;
  }
}
export { classIncludes };
