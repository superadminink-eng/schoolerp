"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { PermissionGate } from "@/components/shared/permission-gate";
import { PaymentForm } from "@/components/fees/payment-form";
import { PaymentHistory } from "@/components/fees/payment-history";
import { FormSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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

  const [submitting, setSubmitting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Success dialog state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successPayment, setSuccessPayment] = useState<{ id: string; amount: number; receiptNo: string | null; count?: number } | null>(null);

  const { data: responseData, error, isLoading, mutate } = useSWR<{ success: boolean; data: FeeData; error?: any }>(
    `/api/v1/fees/${params.studentId}`,
    fetcher
  );

  const data = responseData?.success ? responseData.data : null;
  const loading = isLoading;

  useEffect(() => {
    if (responseData && !responseData.success) {
      snackbar.show(responseData.error?.message ?? "Student not found", "error");
      router.push("/fees");
    }
  }, [responseData, router, snackbar]);

  useEffect(() => {
    if (error) {
      snackbar.show("Failed to load fee details", "error");
      router.push("/fees");
    }
  }, [error, router, snackbar]);

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
      
      if (!res.ok) {
        throw new Error("HTTP Error");
      }
      
      const json = await res.json();

      if (json.success) {
        snackbar.show(
          `Payment of ${formatCurrency(formData.amount)} recorded successfully`,
          "success"
        );
        
        await mutate();

        // Trigger success print modal
        const pay = json.data?.payment;
        if (pay) {
          setSuccessPayment({
            id: pay.id,
            amount: json.data?.totalProcessedAmount || formData.amount,
            receiptNo: pay.receiptNo,
            count: json.data?.paymentsCount || 1,
          });
          setSuccessModalOpen(true);
        }
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
    <div className="space-y-5 max-w-7xl mx-auto pb-6 px-1">
      {/* Top Breadcrumb & Heading Bar */}
      <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-2xl">payments</span>
            Fee Collection
          </h1>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-sm font-medium text-slate-550 dark:text-slate-400">
            {student.firstName} {student.lastName}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
          Dashboard / Fees / Collection
        </div>
      </div>
      <div className="space-y-4">
        {/* Compact Student Header Bar - Luxury Redesign */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md py-4.5 px-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-950 dark:bg-slate-50 text-white dark:text-slate-950 text-base font-bold flex items-center justify-center shadow-sm shrink-0">
              {((student.firstName[0] || "") + (student.lastName[0] || "")).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 leading-tight tracking-tight">
                  {student.firstName} {student.lastName}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200/50 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-900/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-455 font-medium flex items-center gap-3.5 flex-wrap mt-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">badge</span>
                  Adm: <strong className="font-mono text-slate-700 dark:text-slate-350">{student.admissionNo}</strong>
                </span>
                <span className="text-slate-200 dark:text-slate-800">|</span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">school</span>
                  Class: <strong className="text-slate-700 dark:text-slate-350">{student.className ?? "—"}</strong>
                </span>
                <span className="text-slate-200 dark:text-slate-800">|</span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-slate-400">lan</span>
                  Branch: <strong className="text-slate-700 dark:text-slate-350">{student.branchName}</strong>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0 justify-between lg:justify-end">
            {/* Apple Card inspired minimalist Stats Panel */}
            <div className="flex items-center gap-6 bg-slate-50/50 dark:bg-slate-950/20 px-5 py-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/60 shadow-2xs">
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Total Fees</span>
                <span className="text-sm font-bold text-slate-850 dark:text-slate-200 mt-0.5 block tracking-tight">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.totalAmount, 0))}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200/60 dark:bg-slate-800/80" />
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Total Paid</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-450 mt-0.5 block tracking-tight">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.paidAmount, 0))}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200/60 dark:bg-slate-800/80" />
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block uppercase tracking-wider font-bold">Outstanding</span>
                <span className={cn("text-sm font-bold mt-0.5 block tracking-tight", totalPendingAll > 0 ? "text-rose-600 dark:text-rose-450" : "text-emerald-600 dark:text-emerald-450")}>
                  {formatCurrency(totalPendingAll)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outlined"
              size="sm"
              icon="print"
              onClick={() => window.open(`/fees/${student.id}/statement/print`, "_blank")}
              className="hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 font-semibold text-xs px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl shadow-2xs h-[42px] cursor-pointer"
            >
              Statement
            </Button>
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Installments Selection */}
            {invoices.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">splitscreen</span>
                  Select Installment to Pay
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {invoices.map((inv, idx) => {
                    const isSelected = selectedInvoiceId === inv.id;
                    const isOverdue = inv.status === "OVERDUE" || (inv.status !== "PAID" && new Date(inv.dueDate) < new Date());
                    
                    let dotColorClass = "";
                    let badgeClass = "";

                    if (inv.status === "PAID") {
                      dotColorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
                      badgeClass = "bg-emerald-500/[0.04] text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/[0.02] dark:text-emerald-400 dark:border-emerald-500/10";
                    } else if (isOverdue) {
                      dotColorClass = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-pulse";
                      badgeClass = "bg-rose-500/[0.04] text-rose-700 border-rose-500/20 dark:bg-rose-500/[0.02] dark:text-rose-450 dark:border-rose-500/10";
                    } else if (inv.status === "PARTIAL") {
                      dotColorClass = "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]";
                      badgeClass = "bg-sky-500/[0.04] text-sky-700 border-sky-500/20 dark:bg-sky-500/[0.02] dark:text-sky-400 dark:border-sky-500/10";
                    } else {
                      dotColorClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
                      badgeClass = "bg-amber-500/[0.04] text-amber-700 border-amber-500/20 dark:bg-amber-500/[0.02] dark:text-amber-400 dark:border-amber-500/10";
                    }

                    return (
                      <div
                        key={inv.id}
                        className={cn(
                          "cursor-pointer rounded-2xl border py-4.5 px-5 transition-all duration-300 relative select-none flex flex-col justify-between shadow-2xs hover:shadow-sm hover:-translate-y-[1.5px]",
                          isSelected
                            ? "border-slate-950 dark:border-slate-100 bg-slate-50/[0.04] dark:bg-slate-950/20 shadow-[0_8px_30px_rgba(0,0,0,0.015)]"
                            : "border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900 hover:border-slate-350 dark:hover:border-slate-700"
                        )}
                        onClick={() => setSelectedInvoiceId(inv.id)}
                      >
                        {/* Selected Indicator - Floating Badge overlay */}
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 bg-slate-950 dark:bg-slate-50 text-white dark:text-slate-950 w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900 animate-fadeIn scale-100">
                            <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                          </div>
                        )}

                        {/* Top: Installment Label & Status */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div className="flex items-center gap-1.5 text-xs pr-6">
                            <span className="material-symbols-outlined text-slate-400 text-[15px]">receipt_long</span>
                            <span className="font-bold text-slate-850 dark:text-slate-200 leading-snug">{getInstallmentLabel(inv, idx)}</span>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider border shrink-0 flex items-center gap-1.5",
                            badgeClass
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", dotColorClass)} />
                            {isOverdue && inv.status !== "PAID" ? "OVERDUE" : inv.status}
                          </span>
                        </div>

                        {/* Invoice & Due Date */}
                        <div className="text-[11px] text-slate-450 font-medium mb-4 flex justify-between">
                          <span>Invoice: {inv.number}</span>
                          <span className="flex items-center gap-1 text-[10px] text-slate-455 font-semibold uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[12px] text-slate-400">calendar_today</span>
                            Due: {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Breakdown Metrics */}
                        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-850/80 pt-3 text-center">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Total</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mt-0.5">{formatCurrency(inv.totalAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-450 block tracking-wider">Paid</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-450 block mt-0.5">{formatCurrency(inv.paidAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-450 block tracking-wider">Pending</span>
                            <span className={cn(
                              "text-xs font-bold block mt-0.5", 
                              inv.pendingAmount > 0 
                                ? isOverdue ? "text-rose-600" : "text-rose-500" 
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
            )}

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="space-y-3 pt-1">
                <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">history</span>
                  Payment Receipt Ledger
                </h2>
                <PaymentHistory payments={payments} />
              </div>
            )}
          </div>

          {/* Right Column (1/3 width) - Combined Collection Panel */}
          <div className="lg:col-span-1">
            {selectedInvoice && (
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300">
                
                {/* Panel Header */}
                <div className="bg-slate-50/50 dark:bg-slate-900/35 px-5 py-4 border-b border-slate-150 dark:border-slate-800/80 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-lg">payments</span>
                  <div className="min-w-0">
                    <h3 className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Collection Desk</h3>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                      Paying for {selectedInvoice.number}
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Integrated Invoice Breakdown */}
                  <div className="space-y-2">
                    <span className="block font-bold text-slate-400 uppercase text-[8px] tracking-wider px-1">Installment Breakdown</span>
                    <div className="border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 bg-slate-50/30 dark:bg-slate-950/10 space-y-2">
                      {(() => {
                        const itemsToShow = selectedInvoice.items.length > 0 
                          ? selectedInvoice.items 
                          : [{ id: "fallback", description: getInstallmentLabel(selectedInvoice, invoices.findIndex(i => i.id === selectedInvoice.id)), amount: selectedInvoice.totalAmount }];

                        return itemsToShow.map((item) => {
                          const isLateFee = item.id.startsWith("late-fee-");
                          return (
                            <div key={item.id} className="flex justify-between items-center text-xs font-semibold">
                              <span className={isLateFee ? "text-rose-600 font-bold" : "text-slate-500 dark:text-slate-400"}>{item.description || "Fee Item"}</span>
                              <span className={isLateFee ? "text-rose-600 font-bold" : "text-slate-850 dark:text-slate-200"}>{formatCurrency(item.amount)}</span>
                            </div>
                          );
                        });
                      })()}
                      
                      <div className="border-t border-dashed border-slate-200 dark:border-slate-800/80 pt-2 flex justify-between items-center text-xs font-extrabold text-slate-800 dark:text-slate-250">
                        <span>Balance Due:</span>
                        <span className={selectedInvoice.pendingAmount > 0 ? "text-rose-600 font-black" : "text-emerald-600 font-black"}>
                          {formatCurrency(selectedInvoice.pendingAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment form */}
                  {!isPaid ? (
                    <PermissionGate module="fees" action="create">
                      <div className="pt-3.5 border-t border-slate-150 dark:border-slate-800/80">
                        <PaymentForm
                          maxAllowedAmount={totalPendingAll}
                          suggestedAmount={selectedInvoice.pendingAmount}
                          invoiceId={selectedInvoice.id}
                          onSubmit={handlePayment}
                          submitting={submitting}
                        />
                      </div>
                    </PermissionGate>
                  ) : (
                    <div className="py-5 text-center space-y-3 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl p-4.5">
                      <div className="w-9 h-9 bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-full flex items-center justify-center mx-auto shadow-xs">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Installment Fully Collected</p>
                        <p className="text-[10px] text-slate-450 font-semibold px-2 leading-relaxed">
                          {totalPendingAll > 0 
                            ? "Select another pending installment card on the left to record payment."
                            : "All fees have been collected for this academic year."
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="max-w-md p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-black text-slate-800 dark:text-slate-200">
                Payment Recorded!
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 px-4">
                The fee payment has been registered in the system ledger database successfully.
              </DialogDescription>
            </div>

            {successPayment && (
              <div className="w-full bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-900 text-left space-y-2 text-xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt No:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                    {successPayment.receiptNo ?? "—"}
                    {(successPayment.count && successPayment.count > 1) ? (
                      <span className="text-slate-400 font-normal ml-1">
                        (+ {successPayment.count - 1} more)
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Processed:</span>
                  <span className="text-emerald-600 font-bold">₹{successPayment.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {(successPayment?.count && successPayment.count > 1) ? (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 text-[10px] text-amber-800 dark:text-amber-200 text-left leading-relaxed">
                <strong>Note:</strong> This payment was distributed across {successPayment.count} installments. The Print button below will only print the primary receipt. You can print the remaining receipts from the Payment Ledger.
              </div>
            ) : null}

            <div className="flex gap-3 w-full pt-2">
              <Button
                type="button"
                variant="outlined"
                icon="print"
                onClick={() => {
                  if (successPayment) {
                    window.open(`/fees/receipt/${successPayment.id}/print`, "_blank");
                  }
                  setSuccessModalOpen(false);
                }}
                className="flex-1 hover:scale-[1.02] transition-all duration-200 font-bold"
              >
                Print Receipt
              </Button>
              <Button
                type="button"
                variant="filled"
                onClick={() => setSuccessModalOpen(false)}
                className="flex-1 hover:scale-[1.02] transition-all duration-200 font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
