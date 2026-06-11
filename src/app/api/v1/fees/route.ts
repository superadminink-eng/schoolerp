import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, parsePagination } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

/**
 * GET /api/v1/fees — list students with pending fees
 */
export async function GET(req: NextRequest) {
  const denied = await checkApiPermission(req, "fees", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const url = new URL(req.url);
  const { page, limit, search } = parsePagination(url);
  const branchId = url.searchParams.get("branchId");

  try {
    // Build where clause for students with pending amounts
    const studentWhere: Record<string, any> = {
      organizationId: ctx.organizationId,
      invoices: {
        some: {
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        },
      },
    };

    // Restrict branch-scoped roles to their home branch
    if (ctx.branchId && branchId !== "__all__") {
      studentWhere.branchId = ctx.branchId;
    } else if (branchId && branchId !== "ALL" && branchId !== "__all__") {
      studentWhere.branchId = branchId;
    }

    // Search on student fields
    if (search) {
      studentWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { admissionNo: { contains: search } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          photo: true,
          branch: { select: { id: true, name: true } },
          enrollments: {
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              section: {
                select: {
                  name: true,
                  class: { select: { name: true } },
                },
              },
            },
          },
          invoices: {
            where: {
              status: { not: "CANCELLED" },
            },
            select: {
              id: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
              dueDate: true,
            },
          },
        },
        orderBy: { firstName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where: studentWhere }),
    ]);

    const rows = students.map((s) => {
      const enrollment = s.enrollments[0];
      const className = enrollment
        ? `${enrollment.section.class.name} - ${enrollment.section.name}`
        : "—";

      let totalAmount = 0;
      let paidAmount = 0;
      let hasOverdue = false;
      const unpaidInvoices: typeof s.invoices = [];

      for (const inv of s.invoices) {
        totalAmount += Number(inv.totalAmount);
        paidAmount += Number(inv.paidAmount);

        if (
          inv.status === "PENDING" ||
          inv.status === "PARTIAL" ||
          inv.status === "OVERDUE"
        ) {
          unpaidInvoices.push(inv);
          if (inv.status === "OVERDUE") {
            hasOverdue = true;
          }
        }
      }

      const pendingAmount = totalAmount - paidAmount;

      let dueDate = null;
      if (unpaidInvoices.length > 0) {
        const dates = unpaidInvoices.map((inv) => new Date(inv.dueDate).getTime());
        dueDate = new Date(Math.min(...dates));
      }

      let status = "PAID";
      if (pendingAmount > 0) {
        if (hasOverdue) {
          status = "OVERDUE";
        } else if (paidAmount > 0) {
          status = "PARTIAL";
        } else {
          status = "PENDING";
        }
      }

      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNo: s.admissionNo,
        photo: s.photo,
        className,
        branchName: s.branch.name,
        totalAmount,
        paidAmount,
        pendingAmount,
        status,
        dueDate,
      };
    });

    return apiSuccess(rows, { page, limit, total });
  } catch (error) {
    console.error("List pending fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list pending fees", 500);
  }
}
