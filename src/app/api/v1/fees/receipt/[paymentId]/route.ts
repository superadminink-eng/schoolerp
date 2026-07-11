import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ paymentId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "fees", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { paymentId } = await context.params;

  try {
    const payment = await prisma.feePayment.findFirst({
      where: {
        id: paymentId,
        student: {
          branch: { organizationId: ctx.organizationId },
          ...(ctx.roleName !== "SUPER_ADMIN" && ctx.roleName !== "SCHOOL_ADMIN" && ctx.branchId
            ? { branchId: ctx.branchId }
            : {}),
        },
      },
      select: {
        id: true,
        receiptNo: true,
        amount: true,
        method: true,
        transactionId: true,
        paidAt: true,
        remarks: true,
        invoice: {
          select: {
            id: true,
            number: true,
            totalAmount: true,
            dueDate: true,
            payments: {
              select: {
                id: true,
                amount: true,
                paidAt: true,
              },
              orderBy: {
                paidAt: 'asc'
              }
            }
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            branch: { select: { name: true } },
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
    });

    if (!payment) {
      return apiNotFound("Payment Record");
    }

    const enrollment = payment.student.enrollments[0];
    const className = enrollment
      ? `${enrollment.section.class.name} - ${enrollment.section.name}`
      : "—";

    // Calculate the paid amount chronologically up to and including this receipt
    let paidAmountUpToThis = 0;
    for (const p of payment.invoice.payments) {
      paidAmountUpToThis += Number(p.amount);
      if (p.id === payment.id) break;
    }

    return apiSuccess({
      id: payment.id,
      receiptNo: payment.receiptNo,
      amount: Number(payment.amount),
      method: payment.method,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt,
      remarks: payment.remarks,
      invoice: {
        id: payment.invoice.id,
        number: payment.invoice.number,
        totalAmount: Number(payment.invoice.totalAmount),
        paidAmount: paidAmountUpToThis,
        pendingAmount: Number(payment.invoice.totalAmount) - paidAmountUpToThis,
        dueDate: payment.invoice.dueDate,
      },
      student: {
        id: payment.student.id,
        firstName: payment.student.firstName,
        lastName: payment.student.lastName,
        admissionNo: payment.student.admissionNo,
        branchName: payment.student.branch.name,
        className,
      },
    });
  } catch (error) {
    console.error("Get fee receipt error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load receipt details", 500);
  }
}
