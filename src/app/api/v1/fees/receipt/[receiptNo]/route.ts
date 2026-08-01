import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiNotFound } from "@/lib/api-helpers";
import { checkApiPermission, getTenantContext } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ receiptNo: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await checkApiPermission(req, "fees", "read");
  if (denied) return denied;

  const ctx = getTenantContext(req);
  const { receiptNo } = await context.params;

  try {
    const param = receiptNo; // Dynamic param from the URL

    // Try by transactionId first
    let payments = await prisma.feePayment.findMany({
      where: {
        transactionId: param,
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
            payments: { select: { id: true, amount: true, paidAt: true }, orderBy: { id: 'asc' } }
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
              select: { section: { select: { name: true, class: { select: { name: true } } } } },
            },
          },
        },
      },
    });

    // Fallback 1: Try by receiptNo
    if (!payments || payments.length === 0) {
      payments = await prisma.feePayment.findMany({
        where: {
          receiptNo: param,
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
              payments: { select: { id: true, amount: true, paidAt: true }, orderBy: { id: 'asc' } }
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
                select: { section: { select: { name: true, class: { select: { name: true } } } } },
              },
            },
          },
        },
      });
    }

    // Fallback 2: Check if it's a legacy ID
    if (!payments || payments.length === 0) {
      const legacyPayment = await prisma.feePayment.findUnique({
        where: { id: param },
        select: { receiptNo: true, transactionId: true },
      });

      if (legacyPayment) {
        if (legacyPayment.transactionId) {
          payments = await prisma.feePayment.findMany({
            where: {
              transactionId: legacyPayment.transactionId,
              student: { branch: { organizationId: ctx.organizationId } },
            },
            // ... (I need to select the same fields as above, which I will just copy-paste below)
            select: {
              id: true, receiptNo: true, amount: true, method: true, transactionId: true, paidAt: true, remarks: true,
              invoice: { select: { id: true, number: true, totalAmount: true, dueDate: true, payments: { select: { id: true, amount: true, paidAt: true }, orderBy: { id: 'asc' } } } },
              student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, branch: { select: { name: true } }, enrollments: { take: 1, orderBy: { enrolledAt: "desc" }, select: { section: { select: { name: true, class: { select: { name: true } } } } } } } },
            }
          });
        } else if (legacyPayment.receiptNo) {
          payments = await prisma.feePayment.findMany({
            where: {
              receiptNo: legacyPayment.receiptNo,
              student: { branch: { organizationId: ctx.organizationId } },
            },
            select: {
              id: true, receiptNo: true, amount: true, method: true, transactionId: true, paidAt: true, remarks: true,
              invoice: { select: { id: true, number: true, totalAmount: true, dueDate: true, payments: { select: { id: true, amount: true, paidAt: true }, orderBy: { id: 'asc' } } } },
              student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, branch: { select: { name: true } }, enrollments: { take: 1, orderBy: { enrolledAt: "desc" }, select: { section: { select: { name: true, class: { select: { name: true } } } } } } } },
            }
          });
        } else {
          payments = await prisma.feePayment.findMany({
            where: {
              id: param,
              student: { branch: { organizationId: ctx.organizationId } },
            },
            select: {
              id: true, receiptNo: true, amount: true, method: true, transactionId: true, paidAt: true, remarks: true,
              invoice: { select: { id: true, number: true, totalAmount: true, dueDate: true, payments: { select: { id: true, amount: true, paidAt: true }, orderBy: { id: 'asc' } } } },
              student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, branch: { select: { name: true } }, enrollments: { take: 1, orderBy: { enrolledAt: "desc" }, select: { section: { select: { name: true, class: { select: { name: true } } } } } } } },
            }
          });
        }
      }
    }

    if (!payments || payments.length === 0) {
      return apiNotFound("Payment Record for this Receipt");
    }

    const firstPayment = payments[0];
    const enrollment = firstPayment.student.enrollments[0];
    const className = enrollment
      ? `${enrollment.section.class.name} - ${enrollment.section.name}`
      : "—";

    const consolidatedAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const allReceipts = Array.from(new Set(payments.map(p => p.receiptNo).filter(Boolean)));
    const receiptString = allReceipts.length > 0 ? allReceipts.join(", ") : null;
    
    const paidInvoices = payments.map(p => {
      // Calculate the paid amount chronologically up to and including this receipt's payment
      let paidAmountUpToThis = 0;
      for (const invPay of p.invoice.payments) {
        paidAmountUpToThis += Number(invPay.amount);
        if (invPay.id === p.id) break;
      }
      
      const totalAmt = Number(p.invoice.totalAmount);
      return {
        id: p.invoice.id,
        number: p.invoice.number,
        amountPaidInThisReceipt: Number(p.amount),
        totalAmount: totalAmt,
        paidAmount: paidAmountUpToThis,
        pendingAmount: totalAmt - paidAmountUpToThis,
        dueDate: p.invoice.dueDate,
      };
    });

    return apiSuccess({
      receiptNo: receiptString,
      amount: consolidatedAmount,
      method: firstPayment.method,
      transactionId: firstPayment.transactionId,
      paidAt: firstPayment.paidAt,
      remarks: firstPayment.remarks,
      student: {
        id: firstPayment.student.id,
        firstName: firstPayment.student.firstName,
        lastName: firstPayment.student.lastName,
        admissionNo: firstPayment.student.admissionNo,
        branchName: firstPayment.student.branch.name,
        className,
      },
      invoices: paidInvoices,
    });
  } catch (error) {
    console.error("Get fee receipt error:", error);
    return apiError("INTERNAL_ERROR", "Failed to load receipt details", 500);
  }
}
