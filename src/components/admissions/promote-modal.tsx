"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface Section {
  id: string;
  name: string;
}

interface InstallmentTemplate {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
}

interface CustomInstallment {
  templateId: string;
  amount: number;
  checked: boolean;
}

interface PromoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  applicationNo: string;
  classSections: Section[];
  installmentTemplates: InstallmentTemplate[];
  customInstallments: CustomInstallment[];
  setCustomInstallments: (val: any) => void;
  promoteForm: {
    sectionId: string;
    rollNo: string;
    admissionDate: string;
    discountPercent: number;
    amountPaid: number;
    paymentMethod: "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI";
    transactionId: string;
    termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
  };
  setPromoteForm: (val: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function PromoteModal({
  open,
  onOpenChange,
  candidateName,
  applicationNo,
  classSections,
  installmentTemplates,
  customInstallments,
  setCustomInstallments,
  promoteForm,
  setPromoteForm,
  onSubmit,
  loading,
}: PromoteModalProps) {
  const handleFormChange = (field: string, value: any) => {
    setPromoteForm((prev: any) => {
      const next = { ...prev, [field]: value };
      
      // Auto-recalculate installments on discount change
      if (field === "discountPercent") {
        const discount = Number(value) || 0;
        setCustomInstallments((insts: CustomInstallment[]) =>
          insts.map((inst, index) => {
            const template = installmentTemplates.find((t) => t.id === inst.templateId);
            const baseAmount = template ? Number(template.amount) : 0;
            return {
              ...inst,
              amount: Math.max(0, Math.round(baseAmount * (1 - discount / 100))),
            };
          })
        );
      }
      return next;
    });
  };

  const handleInstallmentCheckChange = (index: number, checked: boolean) => {
    const nextInsts = [...customInstallments];
    nextInsts[index] = { ...nextInsts[index], checked };
    setCustomInstallments(nextInsts);
  };

  const handleInstallmentAmountChange = (index: number, amount: number) => {
    const nextInsts = [...customInstallments];
    nextInsts[index] = { ...nextInsts[index], amount };
    setCustomInstallments(nextInsts);
  };

  // Calculate totals
  const baseTotal = installmentTemplates.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const activeInstallmentsTotal = customInstallments
    .filter((inst) => inst.checked)
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b border-slate-50 dark:border-zinc-800/60 pb-4 shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              Registrar Desk: SIS Enrollment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              Promote shortlisted candidate <strong className="text-slate-700 dark:text-zinc-300">{candidateName} ({applicationNo})</strong> to an active student, mapping class divisions and setting up fee installments.
            </DialogDescription>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Section 1: Academic Placement */}
          <div className="p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-2">
              <Icon name="school" size={14} className="text-primary" />
              1. Class Placement Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Section Select */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Class Division (Section) <span className="text-red-500">*</span>
                </label>
                <Select
                  value={promoteForm.sectionId}
                  onValueChange={(val) => handleFormChange("sectionId", val)}
                >
                  <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {classSections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Section {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Roll No */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Roll Number (Optional)
                </label>
                <input
                  type="text"
                  value={promoteForm.rollNo}
                  onChange={(e) => handleFormChange("rollNo", e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                />
              </div>

              {/* Admission Date */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Admission Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={promoteForm.admissionDate}
                  onChange={(e) => handleFormChange("admissionDate", e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Fee Installments Allocation */}
          <div className="p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Icon name="receipt_long" size={14} className="text-amber-500" />
                2. Fee Schedule & Billing setup
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-450 dark:text-zinc-500 select-none">Term:</span>
                <select
                  value={promoteForm.termType}
                  onChange={(e) => handleFormChange("termType", e.target.value)}
                  className="text-xs font-extrabold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-lg p-1.5 text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="FULL_TERM">Full Term</option>
                  <option value="HALF_TERM">Half Term</option>
                  <option value="SHORT_TERM">Short Term</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Discount Scholarship (%)
                </label>
                <input
                  type="number"
                  value={String(promoteForm.discountPercent)}
                  onChange={(e) => handleFormChange("discountPercent", e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Class Base Total
                </label>
                <div className="flex items-center justify-center h-12 rounded-xl bg-slate-100/50 dark:bg-zinc-950/40 border border-slate-200/60 dark:border-zinc-800/80 text-sm font-extrabold text-slate-700 dark:text-zinc-300 select-none">
                  ₹{baseTotal}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Onboarding Total
                </label>
                <div className="flex items-center justify-center h-12 rounded-xl bg-primary/5 dark:bg-sky-500/[0.03] border border-primary/20 dark:border-sky-500/20 text-sm font-black text-primary dark:text-sky-400 select-none">
                  ₹{activeInstallmentsTotal}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Installment Templates Checklist (Edit or Deselect)
              </label>

              {installmentTemplates.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">
                  No installment templates configured for this class/term.
                </div>
              ) : (
                <div className="space-y-2">
                  {installmentTemplates.map((t, index) => {
                    const inst = customInstallments.find((ci) => ci.templateId === t.id) || {
                      checked: false,
                      amount: 0,
                    };
                    return (
                      <div
                        key={t.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all duration-300 ${
                          inst.checked
                            ? "bg-white dark:bg-zinc-900/60 border-primary/30 dark:border-primary/20 shadow-sm"
                            : "bg-slate-50/40 dark:bg-zinc-950/10 border-slate-100 dark:border-zinc-900 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={inst.checked}
                            onChange={(e) => handleInstallmentCheckChange(index, e.target.checked)}
                            className="rounded text-primary focus:ring-primary/20 w-4.5 h-4.5 border-slate-350 dark:border-zinc-800"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-850 dark:text-zinc-200">
                              {t.name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-0.5">
                              Due: {new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            disabled={!inst.checked}
                            value={String(inst.amount)}
                            onChange={(e) => handleInstallmentAmountChange(index, Number(e.target.value) || 0)}
                            className="w-28 h-9 text-xs font-bold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 text-right text-slate-800 dark:text-zinc-200 outline-none focus:border-primary disabled:opacity-50 transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Initial Admission Fee Payment */}
          <div className="p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-2">
              <Icon name="payments" size={14} className="text-emerald-500" />
              3. Initial Admission Payment (Optional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Amount Paid Now */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Amount Paid Now
                </label>
                <input
                  type="number"
                  value={String(promoteForm.amountPaid)}
                  onChange={(e) => handleFormChange("amountPaid", e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                />
              </div>

              {/* Payment Method */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Payment Method
                </label>
                <Select
                  value={promoteForm.paymentMethod}
                  onValueChange={(val) => handleFormChange("paymentMethod", val)}
                >
                  <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                    <SelectValue placeholder="Select Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash Payment</SelectItem>
                    <SelectItem value="UPI">UPI Transfer</SelectItem>
                    <SelectItem value="ONLINE">Online Portal</SelectItem>
                    <SelectItem value="CHEQUE">Bank Cheque</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction ID */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                  Transaction / Reference ID
                </label>
                <input
                  type="text"
                  value={promoteForm.transactionId}
                  onChange={(e) => handleFormChange("transactionId", e.target.value)}
                  placeholder="e.g. TXN9876543"
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800 shrink-0">
            <DialogClose asChild>
              <Button variant="outlined" className="rounded-xl h-11 px-5">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="filled"
              icon="school"
              loading={loading}
              className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 shadow-md shadow-primary/15"
            >
              Promote to Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
