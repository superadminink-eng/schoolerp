"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  createFeePaymentSchema,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type CreateFeePaymentInput,
} from "@/lib/validations/fee-payment";
import { BaseCurrencyInput } from "@/components/ui/base-currency-input";

interface PaymentFormProps {
  maxAllowedAmount: number;
  suggestedAmount: number;
  invoiceId?: string;
  onSubmit: (data: CreateFeePaymentInput) => Promise<void>;
  submitting: boolean;
}

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN")}`;

const METHODS_WITH_TXN_ID = new Set(["UPI", "ONLINE", "BANK_TRANSFER"]);

export function PaymentForm({
  maxAllowedAmount,
  suggestedAmount,
  invoiceId,
  onSubmit,
  submitting,
}: PaymentFormProps) {
  const [amount, setAmount] = useState("");
  
  // Pre-fill amount when suggestedAmount or invoiceId changes
  useEffect(() => {
    if (suggestedAmount > 0) {
      setAmount(suggestedAmount.toString());
    } else {
      setAmount("");
    }
  }, [suggestedAmount, invoiceId]);

  const [paidAt, setPaidAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [method, setMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const numericAmount = parseFloat(amount) || 0;
  const remainingAfter = Math.round((maxAllowedAmount - numericAmount) * 100) / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const formData = {
      amount: numericAmount,
      method: method as CreateFeePaymentInput["method"],
      paidAt,
      transactionId,
      remarks,
      invoiceId,
    };

    const parsed = createFeePaymentSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const err of parsed.error.errors) {
        fieldErrors[err.path.join(".")] = err.message;
      }
      setErrors(fieldErrors);
      return;
    }

    if (numericAmount > maxAllowedAmount) {
      setErrors({ amount: `Amount cannot exceed total outstanding balance of ${formatCurrency(maxAllowedAmount)}` });
      return;
    }

    await onSubmit(parsed.data);

    // Reset form on success
    setAmount("");
    setTransactionId("");
    setRemarks("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center px-1">
          <label
            htmlFor="amount"
            className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider"
          >
            Amount
          </label>
          <button 
            type="button" 
            onClick={() => setAmount(maxAllowedAmount.toString())}
            className="text-[9px] font-bold text-teal-600 dark:text-teal-400 hover:underline uppercase tracking-wider cursor-pointer"
          >
            Pay Full Amount
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
            ₹
          </span>
          <BaseCurrencyInput
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 focus:bg-white dark:focus:bg-slate-900 pl-8.5 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-slate-900 dark:focus:border-slate-100 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all duration-250 font-bold"
            placeholder="0.00"
          />
        </div>
        {errors.amount && (
          <p className="text-rose-600 text-[11px] mt-1 font-semibold px-1">{errors.amount}</p>
        )}
        {numericAmount > 0 && numericAmount <= maxAllowedAmount && (
          <p className="text-[11px] text-slate-450 mt-1 px-1 font-semibold">
            Remaining after payment:{" "}
            <span className={remainingAfter > 0 ? "text-rose-500" : "text-emerald-600"}>
              {formatCurrency(remainingAfter)}
            </span>
          </p>
        )}
      </div>

      {/* Date & Method (2-Column Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Payment Date */}
        <div className="space-y-1.5">
          <label
            htmlFor="paidAt"
            className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider px-1"
          >
            Payment Date
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
              calendar_today
            </span>
            <input
              id="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/40 focus:bg-white dark:focus:bg-slate-900 pl-9.5 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-slate-900 dark:focus:border-slate-100 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all duration-250 font-semibold cursor-pointer"
            />
          </div>
          {errors.paidAt && (
            <p className="text-rose-600 text-[11px] mt-1 font-semibold px-1">{errors.paidAt}</p>
          )}
        </div>

        {/* Payment Method */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider px-1">
            Payment Method
          </label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-full rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 focus:border-slate-900 dark:focus:border-slate-100 py-2.5 text-sm font-semibold h-[42px] transition-all duration-250">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m} className="cursor-pointer font-semibold">
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.method && (
            <p className="text-rose-600 text-[11px] mt-1 font-semibold px-1">{errors.method}</p>
          )}
        </div>
      </div>

      {/* Transaction ID — shown for UPI, Online, Bank Transfer */}
      {METHODS_WITH_TXN_ID.has(method) && (
        <div className="space-y-1.5 animate-fadeIn">
          <label
            htmlFor="transactionId"
            className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider px-1"
          >
            Transaction ID
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
              key
            </span>
            <input
              id="transactionId"
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 focus:bg-white dark:focus:bg-slate-900 pl-9.5 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-slate-900 dark:focus:border-slate-100 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all duration-250 font-mono"
              placeholder="Enter transaction ID"
              maxLength={100}
            />
          </div>
        </div>
      )}

      {/* Remarks */}
      <div className="space-y-1.5">
        <label
          htmlFor="remarks"
          className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider px-1"
        >
          Remarks
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
            notes
          </span>
          <input
            id="remarks"
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-955/40 focus:bg-white dark:focus:bg-slate-900 pl-9.5 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-slate-900 dark:focus:border-slate-100 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all duration-250 font-medium"
            placeholder="Optional remarks"
            maxLength={500}
          />
        </div>
      </div>

      <div className="pt-3">
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-105 hover:bg-black dark:hover:bg-white text-white dark:text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all duration-300 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-sm cursor-pointer"
        >
          {submitting ? (
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-sm">payments</span>
          )}
          {numericAmount > 0 && numericAmount <= maxAllowedAmount
            ? `Record Payment • ${formatCurrency(numericAmount)}`
            : "Record Payment"}
        </button>
      </div>
    </form>
  );
}
