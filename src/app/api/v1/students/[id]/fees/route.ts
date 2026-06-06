import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/students/[id]/fees — Retrieve financial fees ledger (invoices & payments) for a student
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const denied = await checkApiPermission(req, "students", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { id } = await params;

  try {
    // 1. Verify student exists in this tenant organization
    const student = await prisma.student.findFirst({
      where: {
        id,
        branch: { organizationId: ctx.organizationId },
        ...(ctx.roleName === "BRANCH_ADMIN" && ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
    });

    if (!student) return apiNotFound("Student");

    // 2. Fetch invoices for this student
    const invoices = await prisma.invoice.findMany({
      where: {
        studentId: id,
        status: { not: "CANCELLED" },
      },
      include: {
        items: {
          include: {
            feeStructure: {
              include: {
                feeCategory: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 3. Fetch fee payments for this student
    const payments = await prisma.feePayment.findMany({
      where: { studentId: id },
      include: {
        invoice: true,
      },
      orderBy: {
        paidAt: "desc",
      },
    });

    // 4. Calculate aggregates
    let totalBilled = 0;
    let totalPaid = 0;

    for (const inv of invoices) {
      totalBilled += Number(inv.totalAmount);
      totalPaid += Number(inv.paidAmount);
    }

    const totalPending = totalBilled - totalPaid;

    return apiSuccess({
      totalBilled,
      totalPaid,
      totalPending,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        dueDate: inv.dueDate,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        balanceAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
        status: inv.status,
        createdAt: inv.createdAt,
        items: inv.items.map((item) => ({
          id: item.id,
          description: item.description || item.feeStructure.feeCategory.name,
          amount: Number(item.amount),
        })),
      })),
      payments: payments.map((pm) => ({
        id: pm.id,
        receiptNo: pm.receiptNo,
        amount: Number(pm.amount),
        method: pm.method,
        transactionId: pm.transactionId,
        paidAt: pm.paidAt,
        remarks: pm.remarks,
        invoiceNumber: pm.invoice.number,
      })),
    });
  } catch (error) {
    console.error("Get student fees error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load financial records", 500);
  }
}
