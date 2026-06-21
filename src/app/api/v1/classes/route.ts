import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  parsePagination,
} from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext, hasPermission } from "@/lib/rbac";
import { buildTenantWhere, buildSearchWhere } from "@/lib/query-helpers";
import { createClassSchema } from "@/lib/validations/class";

/**
 * GET /api/v1/classes — list classes for a branch (current academic year)
 * When ?paginated=true, returns classes with counts for the list page
 */
export async function GET(req: NextRequest) {
  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const paginated = url.searchParams.get("paginated") === "true";

  if (paginated) {
    const denied = await checkApiPermission(req, "classes", "read");
    if (denied) return denied;

    const { page, limit, search } = parsePagination(url);
    const branchId = url.searchParams.get("branchId") || undefined;

    try {
      const where: Record<string, any> = {
        ...(await buildTenantWhere(ctx, branchId)),
        ...buildSearchWhere(search, ["name"]),
      };

      const [classes, total] = await Promise.all([
        prisma.class.findMany({
          where,
          include: {
            branch: { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true } },
            feeStructures: {
              select: {
                amount: true,
                termType: true,
                feeCategory: { select: { name: true } },
              },
            },
            sections: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                classTeacher: { select: { id: true, name: true, deletedAt: true } },
                _count: {
                  select: {
                    studentEnrollments: {
                      where: {
                        student: {
                          status: "ACTIVE"
                        }
                      }
                    }
                  }
                },
              },
              orderBy: { name: "asc" },
            },
            _count: {
              select: {
                sections: { where: { deletedAt: null } },
                subjects: true,
              },
            },
          },
          orderBy: [{ numericGrade: "asc" }, { name: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.class.count({ where }),
      ]);

      const result = classes.map(({ sections: secs, ...rest }) => ({
        ...rest,
        sections: secs.map((s) => ({
          id: s.id,
          name: s.name,
          classTeacher: s.classTeacher?.deletedAt ? null : s.classTeacher,
        })),
        totalStudents: secs.reduce(
          (sum, s) => sum + s._count.studentEnrollments,
          0
        ),
      }));

      return apiSuccess(result, { page, limit, total });
    } catch (error) {
      console.error("List classes (paginated) error:", error);
      return apiError("INTERNAL_ERROR", "Failed to list classes", 500);
    }
  }

  // Lightweight response for student/inquiry form dropdown (original behaviour)
  const allowed = (await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "students", "read")) ||
                  (await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "inquiry_desk")) ||
                  (await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "admissions", "document_verification")) ||
                  (await hasPermission(ctx.userId, ctx.roleId, ctx.roleName, "classes", "read"));
  if (!allowed) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }

  const branchId = url.searchParams.get("branchId");
  
  let targetBranchId = branchId;
  if (ctx.branchId && branchId !== "__all__") {
    targetBranchId = ctx.branchId;
  }

  if (!targetBranchId) {
    return apiError("BAD_REQUEST", "branchId is required", 400);
  }

  // Verify branch belongs to organization
  const branch = await prisma.branch.findFirst({
    where: { id: targetBranchId, organizationId: ctx.organizationId, isActive: true },
  });
  if (!branch) {
    return apiError("NOT_FOUND", "Branch not found", 404);
  }

  try {
    const reqAcademicYearId = url.searchParams.get("academicYearId");
    let targetYearId = reqAcademicYearId;

    if (!targetYearId) {
      let academicYear = await prisma.academicYear.findFirst({
        where: { organizationId: ctx.organizationId, isCurrent: true },
      });
      
      // Fallback: Use the latest academic year if none is marked as current
      if (!academicYear) {
        academicYear = await prisma.academicYear.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { startDate: "desc" },
        });
      }
      
      targetYearId = academicYear?.id || null;
    }

    if (!targetYearId) {
      return apiSuccess([]);
    }

    const classes = await prisma.class.findMany({
      where: {
        branchId: targetBranchId,
        academicYearId: targetYearId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        numericGrade: true,
      },
      orderBy: { numericGrade: "asc" },
    });

    return apiSuccess(classes);
  } catch (error) {
    console.error("List classes error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list classes", 500);
  }
}

/**
 * POST /api/v1/classes — create a new class with subjects, sections, and fees
 */
export async function POST(req: NextRequest) {
  const denied = await checkApiPermission(req, "classes", "create");
  if (denied) return denied;

  const ctx = getTenantContext(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = createClassSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const { name, numericGrade, branchId, academicYearId, sections, fees, installments, subjectMasterIds, status } =
    parsed.data;

  // Enforce sum match for each term type (FULL_TERM, HALF_TERM, SHORT_TERM) individually
  const termTypes = ["FULL_TERM", "HALF_TERM", "SHORT_TERM"] as const;
  for (const t of termTypes) {
    const termFees = fees.filter(f => f.termType === t);
    const termInstallments = installments.filter(i => i.termType === t);
    
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

  // Restrict branch-scoped roles from creating classes in another branch
  if (ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId && branchId !== ctx.branchId) {
    return apiError("FORBIDDEN", "Cannot create class in another branch", 403);
  }

  try {
    // Verify branch belongs to organization
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId: ctx.organizationId, isActive: true },
    });
    if (!branch) {
      return apiError("NOT_FOUND", "Branch not found", 404);
    }

    // Verify academic year belongs to organization
    const academicYear = await prisma.academicYear.findFirst({
      where: { id: academicYearId, organizationId: ctx.organizationId },
    });
    if (!academicYear) {
      return apiError("NOT_FOUND", "Academic year not found", 404);
    }

    // Check name uniqueness within branch + academic year
    const existing = await prisma.class.findFirst({
      where: { branchId, academicYearId, name },
    });
    if (existing) {
      return apiError(
        "CONFLICT",
        "A class with this name already exists for this branch and academic year",
        409
      );
    }

    // Verify all staff IDs assigned as teachers belong to organization
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

    const classRecord = await prisma.$transaction(async (tx) => {
      // Create class
      const cls = await tx.class.create({
        data: {
          branchId,
          organizationId: ctx.organizationId,
          academicYearId,
          name,
          numericGrade,
          status,
        },
      });

      // Create subjects from subject master catalog
      const createdSubjectIds: string[] = [];
      if (subjectMasterIds.length > 0) {
        const masters = await tx.subjectMaster.findMany({
          where: {
            id: { in: subjectMasterIds },
            organizationId: ctx.organizationId,
          },
        });

        for (const masterId of subjectMasterIds) {
          const master = masters.find((m) => m.id === masterId);
          if (!master) continue;

          const subject = await tx.subject.create({
            data: {
              classId: cls.id,
              subjectMasterId: master.id,
              name: master.name,
              code: master.code,
              type: master.type,
            },
          });
          createdSubjectIds.push(subject.id);
        }
      }

      // Create sections with class teacher and subject-teacher assignments
      for (const sec of sections) {
        const section = await tx.section.create({
          data: {
            classId: cls.id,
            name: sec.name,
            classTeacherId: sec.classTeacherId || null,
          },
        });

        // Create section-subject-teacher records
        const sectionSubjectTeacherData = sec.subjectTeachers
          .filter((st) => st.subjectIndex >= 0 && st.subjectIndex < createdSubjectIds.length)
          .map((st) => ({
            sectionId: section.id,
            subjectId: createdSubjectIds[st.subjectIndex],
            staffId: st.staffId,
          }));

        if (sectionSubjectTeacherData.length > 0) {
          await tx.sectionSubjectTeacher.createMany({
            data: sectionSubjectTeacherData,
          });
        }
      }

      // Create fees
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

        await tx.feeStructure.create({
          data: {
            classId: cls.id,
            academicYearId,
            feeCategoryId: feeCategory.id,
            amount: fee.amount,
            frequency: "ANNUAL",
            termType: fee.termType,
          },
        });
      }

      // Create installment templates
      for (const inst of installments) {
        await tx.feeInstallmentTemplate.create({
          data: {
            classId: cls.id,
            academicYearId,
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

      return cls;
    }, { timeout: 30000 });

    // Refetch full record
    const full = await prisma.class.findUnique({
      where: { id: classRecord.id },
      include: {
        subjects: { orderBy: { name: "asc" } },
        sections: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          include: {
            classTeacher: { select: { id: true, name: true, deletedAt: true } },
            sectionSubjectTeachers: {
              where: { staff: { deletedAt: null } },
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
        feeInstallmentTemplates: {
          orderBy: { dueDate: "asc" },
        },
        branch: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });

    const fullFormatted = full
      ? {
          ...full,
          sections: full.sections.map((s: any) => ({
            ...s,
            classTeacher: s.classTeacher?.deletedAt ? null : s.classTeacher,
          })),
        }
      : null;

    return apiSuccess(fullFormatted, undefined, 201);
  } catch (error) {
    console.error("Create class error:", error);
    return apiError("INTERNAL_ERROR", "Failed to create class", 500);
  }
}
