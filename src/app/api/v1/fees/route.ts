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
    // Build where clause for invoices with pending amounts
    const invoiceWhere: Record<string, unknown> = {
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      student: {
        branch: { organizationId: ctx.organizationId },
      },
    };

    // Branch scoping
    if (ctx.roleName === "BRANCH_ADMIN" && ctx.branchId) {
      (invoiceWhere.student as Record<string, unknown>).branchId = ctx.branchId;
    } else if (branchId) {
      (invoiceWhere.student as Record<string, unknown>).branchId = branchId;
    }

    // Search on student fields
    if (search) {
      (invoiceWhere.student as Record<string, unknown>).OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { admissionNo: { contains: search } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          number: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
          student: {
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
            },
          },
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where: invoiceWhere }),
    ]);

    const rows = invoices.map((inv) => {
      const s = inv.student;
      const enrollment = s.enrollments[0];
      const className = enrollment
        ? `${enrollment.section.class.name} - ${enrollment.section.name}`
        : "—";
      const totalAmount = Number(inv.totalAmount);
      const paidAmount = Number(inv.paidAmount);

      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNo: s.admissionNo,
        photo: s.photo,
        className,
        branchName: s.branch.name,
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
        status: inv.status,
        dueDate: inv.dueDate,
      };
    });

    return apiSuccess(rows, { page, limit, total });
  } catch (error) {
    console.error("List pending fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to list pending fees", 500);
  }
}
