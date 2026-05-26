"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Chip } from "@/components/ui/chip";
import { PermissionGate } from "@/components/shared/permission-gate";
import { PaymentForm } from "@/components/fees/payment-form";
import { PaymentHistory } from "@/components/fees/payment-history";
import { FormSkeleton } from "@/components/ui/skeleton";
import type { CreateFeePaymentInput } from "@/lib/validations/fee-payment";

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  photo: string | null;
  branchName: string;
  className: string | null;
}

interface InvoiceItem {
  id: string;
  description: string | null;
  amount: number;
}

interface InvoiceInfo {
  id: string;
  number: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  dueDate: string;
  items: InvoiceItem[];
}

interface Payment {
  id: string;
  receiptNo: string | null;
  amount: number;
  method: string;
  transactionId: string | null;
  paidAt: string;
  remarks: string | null;
}

interface FeeData {
  student: StudentInfo;
  invoice: InvoiceInfo | null;
  payments: Payment[];
}

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN")}`;

const invoiceStatusColor = (status: string) => {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PARTIAL":
      return "primary" as const;
    case "OVERDUE":
      return "error" as const;
    case "PENDING":
    default:
      return "default" as const;
  }
};

export default function FeeCollectionPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [data, setData] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/fees/${params.studentId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        snackbar.show(json.error?.message ?? "Student not found", "error");
        router.push("/fees");
      }
    } catch {
      snackbar.show("Failed to load fee details", "error");
      router.push("/fees");
    } finally {
      setLoading(false);
    }
  }, [params.studentId, router, snackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handlePayment(formData: CreateFeePaymentInput) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/fees/${params.studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (json.success) {
        snackbar.show(
          `Payment of ${formatCurrency(formData.amount)} recorded successfully`,
          "success"
        );
        // Re-fetch to update all data
        setLoading(true);
        await fetchData();
      } else {
        snackbar.show(json.error?.message ?? "Failed to record payment", "error");
      }
    } catch {
      snackbar.show("An error occurred while recording payment", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Breadcrumb>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/fees">Fees</BreadcrumbItem>
          <BreadcrumbItem>Collection</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-headline-md font-semibold text-on-surface mb-6">
          Fee Collection
        </h1>
        <FormSkeleton />
      </div>
    );
  }

  if (!data) return null;

  const { student, invoice, payments } = data;
  const isPaid = invoice?.status === "PAID";

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem href="/fees">Fees</BreadcrumbItem>
        <BreadcrumbItem>
          {student.firstName} {student.lastName}
        </BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Fee Collection
      </h1>

      <div className="space-y-6">
        {/* Student Info */}
        <div className="rounded-md border border-outline-variant bg-surface p-4">
          <h2 className="text-title-md font-medium text-on-surface mb-3">
            Student Information
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-label-md text-on-surface-variant">Name</p>
              <p className="text-body-lg text-on-surface font-medium">
                {student.firstName} {student.lastName}
              </p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">
                Admission No
              </p>
              <p className="text-body-lg text-on-surface">
                {student.admissionNo}
              </p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">Class</p>
              <p className="text-body-lg text-on-surface">
                {student.className ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant">Branch</p>
              <p className="text-body-lg text-on-surface">
                {student.branchName}
              </p>
            </div>
          </div>
        </div>

        {/* Invoice Breakdown */}
        {invoice ? (
          <div className="rounded-md border border-outline-variant bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-title-md font-medium text-on-surface">
                Invoice Breakdown
              </h2>
              <Chip
                label={invoice.status}
                variant="filled"
                color={invoiceStatusColor(invoice.status)}
              />
            </div>

            {/* Fee Items */}
            <div className="space-y-2 mb-4">
              {invoice.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-body-md text-on-surface">
                    {item.description || "Fee"}
                  </span>
                  <span className="text-body-md text-on-surface font-medium">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            <hr className="border-outline-variant mb-4" />

            {/* Summary */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-label-md text-on-surface-variant">Total</p>
                <p className="text-title-lg font-medium text-on-surface">
                  {formatCurrency(invoice.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-label-md text-on-surface-variant">Paid</p>
                <p className="text-title-lg font-medium text-success">
                  {formatCurrency(invoice.paidAmount)}
                </p>
              </div>
              <div>
                <p className="text-label-md text-on-surface-variant">
                  Remaining
                </p>
                <p
                  className={`text-title-lg font-medium ${
                    invoice.pendingAmount > 0 ? "text-error" : "text-success"
                  }`}
                >
                  {formatCurrency(invoice.pendingAmount)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-outline-variant bg-surface p-6 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-2">
              receipt_long
            </span>
            <p className="text-body-lg text-on-surface-variant">
              No invoice found for this student
            </p>
          </div>
        )}

        {/* Record Payment */}
        {invoice && !isPaid && (
          <PermissionGate module="fees" action="create">
            <div className="rounded-md border border-outline-variant bg-surface p-4">
              <h2 className="text-title-md font-medium text-on-surface mb-4">
                Record Payment
              </h2>
              <PaymentForm
                pendingAmount={invoice.pendingAmount}
                onSubmit={handlePayment}
                submitting={submitting}
              />
            </div>
          </PermissionGate>
        )}

        {/* Paid message */}
        {invoice && isPaid && (
          <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4 text-center">
            <span className="material-symbols-outlined text-[36px] text-success mb-1">
              check_circle
            </span>
            <p className="text-body-lg text-success font-medium">
              All fees have been collected
            </p>
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div>
            <h2 className="text-title-md font-medium text-on-surface mb-3">
              Payment History
            </h2>
            <PaymentHistory payments={payments} />
          </div>
        )}
      </div>
    </div>
  );
}
