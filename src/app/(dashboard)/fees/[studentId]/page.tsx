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
import { cn } from "@/lib/utils";
import type { CreateFeePaymentInput } from "@/lib/validations/fee-payment";
import { usePermissions } from "@/hooks/use-permissions";
import { Icon } from "@/components/ui/icon";

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
  invoices: InvoiceInfo[];
  payments: Payment[];
}

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN")}`;

const getInstallmentLabel = (inv: InvoiceInfo, idx: number) => {
  const desc = inv.items.map(i => i.description?.toLowerCase() || "").join(" ");
  if (desc.includes("admission")) return "Installment #1 - Admission Fees";
  if (desc.includes("last")) return "Installment #2 - Last Installment";
  return `Installment #${idx + 1}`;
};

export default function FeeCollectionPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();
  const { can, isLoading: permissionsLoading } = usePermissions();

  const [data, setData] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

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

  // Auto-select oldest unpaid invoice on initial load
  useEffect(() => {
    if (data?.invoices && data.invoices.length > 0) {
      const unpaid = data.invoices.find((inv) => inv.status !== "PAID");
      if (unpaid) {
        setSelectedInvoiceId(unpaid.id);
      } else {
        setSelectedInvoiceId(data.invoices[0].id);
      }
    }
  }, [data]);

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

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-400 gap-3">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
        <span className="text-sm font-bold tracking-wider uppercase">Loading Permissions...</span>
      </div>
    );
  }

  if (!can("fees", "read")) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 space-y-4">
        <Icon name="lock" size={48} className="text-slate-400" />
        <h2 className="text-xl font-bold text-slate-800">Insufficient permissions</h2>
        <p className="text-sm text-slate-500 max-w-md">
          You do not have permission to view fees. Please contact your system administrator.
        </p>
      </div>
    );
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

  const { student, invoices, payments } = data;
  
  // Find selected invoice info
  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0];
  const isPaid = selectedInvoice?.status === "PAID";
  const totalPendingAll = invoices.reduce((sum, inv) => sum + inv.pendingAmount, 0);

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
        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
          <h2 className="text-title-md font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400">person</span>
            Student Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Name</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {student.firstName} {student.lastName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Admission No</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5 font-mono">
                {student.admissionNo}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Class</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {student.className ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Branch</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {student.branchName}
              </p>
            </div>
          </div>
        </div>

        {/* Installments Selection Row */}
        {invoices.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-title-md font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">splitscreen</span>
              Select Installment to Pay
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoices.map((inv, idx) => {
                const isSelected = selectedInvoiceId === inv.id;
                const isOverdue = inv.status === "OVERDUE" || (inv.status !== "PAID" && new Date(inv.dueDate) < new Date());
                return (
                  <div
                    key={inv.id}
                    className={cn(
                      "cursor-pointer rounded-2xl border p-5 transition-all duration-300 relative select-none flex flex-col justify-between shadow-sm",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary"
                        : "border-outline-variant/60 bg-surface hover:border-slate-400 hover:shadow"
                    )}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                  >
                    {/* Selected Badge Indicator */}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center border border-white shadow">
                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                      </div>
                    )}

                    {/* Top Row: Installment Title & Status */}
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                        <span className="font-bold text-sm text-slate-800">{getInstallmentLabel(inv, idx)}</span>
                      </div>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0",
                        inv.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : isOverdue
                          ? "bg-rose-50 text-rose-700 border-rose-200/60 animate-pulse"
                          : inv.status === "PARTIAL"
                          ? "bg-sky-50 text-sky-700 border-sky-200/60"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {isOverdue && inv.status !== "PAID" ? "OVERDUE" : inv.status}
                      </span>
                    </div>

                    {/* Middle Row: Due Date & Invoice No */}
                    <div className="text-[11px] text-slate-400 font-semibold mb-4 flex justify-between">
                      <span>Invoice: {inv.number}</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                        Due: {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Bottom Row: Breakdown metrics */}
                    <div className="grid grid-cols-3 gap-1.5 border-t pt-3.5 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total</span>
                        <span className="text-xs font-semibold text-slate-700">{formatCurrency(inv.totalAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Paid</span>
                        <span className="text-xs font-semibold text-emerald-600">{formatCurrency(inv.paidAmount)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Pending</span>
                        <span className={cn(
                          "text-xs font-black block", 
                          inv.pendingAmount > 0 
                            ? isOverdue ? "text-rose-700" : "text-rose-500" 
                            : "text-emerald-600"
                        )}>
                          {formatCurrency(inv.pendingAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-outline-variant bg-surface p-6 text-center shadow-sm">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-2">
              receipt_long
            </span>
            <p className="text-body-lg text-on-surface-variant">
              No invoice found for this student
            </p>
          </div>
        )}

        {/* Selected Invoice Details & Payment Form Panel */}
        {selectedInvoice && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Selected Installment Details */}
            <div className="md:col-span-2 rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm space-y-4">
              <h3 className="text-title-md font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                Invoice Breakdown: {getInstallmentLabel(selectedInvoice, invoices.findIndex(i => i.id === selectedInvoice.id))}
              </h3>

              <div className="space-y-3">
                {selectedInvoice.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-1.5 px-1 hover:bg-slate-50 rounded transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      {item.description || "Fee Item"}
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>

              <hr className="border-outline-variant" />

              <div className="grid grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl text-center">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Installment Total</p>
                  <p className="text-base font-black text-slate-700 mt-1">
                    {formatCurrency(selectedInvoice.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Amount</p>
                  <p className="text-base font-black text-emerald-600 mt-1">
                    {formatCurrency(selectedInvoice.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</p>
                  <p className={cn(
                    "text-base font-black mt-1",
                    selectedInvoice.pendingAmount > 0 ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(selectedInvoice.pendingAmount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Record Payment Form or Success State */}
            <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-title-md font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mb-4">
                  <span className="material-symbols-outlined text-primary">payments</span>
                  Record Payment
                </h3>

                {!isPaid ? (
                  <PermissionGate module="fees" action="create">
                    <div className="space-y-4">
                      {/* Helper badge telling the operator which invoice they are paying */}
                      <div className="p-3 bg-primary/5 text-primary border border-primary/20 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        <span>
                          Paying for <strong>{selectedInvoice.number}</strong>
                        </span>
                      </div>

                      <PaymentForm
                        pendingAmount={selectedInvoice.pendingAmount}
                        invoiceId={selectedInvoice.id}
                        onSubmit={handlePayment}
                        submitting={submitting}
                      />
                    </div>
                  </PermissionGate>
                ) : (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <span className="material-symbols-outlined text-[24px]">check_circle</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-800">Installment Fully Collected</p>
                      <p className="text-xs text-slate-400 font-semibold px-2">
                        {totalPendingAll > 0 
                          ? "Select another pending installment card above to record a payment."
                          : "All fees have been collected for this academic year."
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Paid Message (if all invoices are paid) */}
        {invoices.length > 0 && totalPendingAll === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center shadow-sm">
            <span className="material-symbols-outlined text-[36px] text-emerald-500 mb-1">
              verified
            </span>
            <p className="text-sm font-black text-emerald-800">
              Account Clear: All student fees have been collected successfully.
            </p>
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-title-md font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">history</span>
              Payment Receipt Ledger
            </h2>
            <PaymentHistory payments={payments} />
          </div>
        )}
      </div>
    </div>
  );
}
