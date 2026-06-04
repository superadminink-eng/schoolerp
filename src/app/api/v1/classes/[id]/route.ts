import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
    orderBy: { name: "asc" as const },
    include: {
      classTeacher: { select: { id: true, name: true } },
      sectionSubjectTeachers: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          staff: { select: { id: true, name: true } },
        },
      },
    },
  },
  feeStructures: {
    include: { feeCategory: { select: { name: true } } },
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
        branch: { organizationId: ctx.organizationId },
      },
      include: classIncludes,
    });

    if (!classRecord) return apiNotFound("Class");

    return apiSuccess(classRecord);
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
        branch: { organizationId: ctx.organizationId },
      },
      include: {
        subjects: true,
        sections: {
          include: { sectionSubjectTeachers: true },
        },
        feeStructures: {
          include: { feeCategory: { select: { name: true } } },
        },
      },
    });

    if (!existing) return apiNotFound("Class");

    const { name, numericGrade, subjects, sections, fees } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // Update basic class fields
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (numericGrade !== undefined) data.numericGrade = numericGrade;

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

        // Check if any sections to remove have enrollments
        if (toRemove.length > 0) {
          const enrollmentCount = await tx.studentEnrollment.count({
            where: { sectionId: { in: toRemove } },
          });
          if (enrollmentCount > 0) {
            throw new Error(
              "CONFLICT:Cannot remove divisions that have enrolled students"
            );
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
              },
            });
          }
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
        branch: { organizationId: ctx.organizationId },
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
