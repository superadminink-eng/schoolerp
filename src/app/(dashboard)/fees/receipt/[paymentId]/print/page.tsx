"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Icon } from "@/components/ui/icon";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/fee-payment";

interface ReceiptData {
  id: string;
  receiptNo: string | null;
  amount: number;
  method: string;
  transactionId: string | null;
  paidAt: string;
  remarks: string | null;
  invoice: {
    id: string;
    number: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    dueDate: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    branchName: string;
    className: string;
  };
}

function getNumberInWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  if (num === 0) return "Zero";
  
  function convertLessThanThousand(n: number): string {
    if (n < 20) return ones[n];
    const digit = n % 10;
    if (n < 100) return tens[Math.floor(n / 10)] + (digit !== 0 ? " " + ones[digit] : "");
    const hundredsDigit = Math.floor(n / 100);
    const rest = n % 100;
    return ones[hundredsDigit] + " Hundred" + (rest !== 0 ? " and " + convertLessThanThousand(rest) : "");
  }

  let words = "";
  let remaining = Math.floor(num);
  
  if (remaining >= 10000000) {
    const crores = Math.floor(remaining / 10000000);
    words += convertLessThanThousand(crores) + " Crore ";
    remaining %= 10000000;
  }
  
  if (remaining >= 100000) {
    const lakhs = Math.floor(remaining / 100000);
    words += convertLessThanThousand(lakhs) + " Lakh ";
    remaining %= 100000;
  }
  
  if (remaining >= 1000) {
    const thousands = Math.floor(remaining / 1000);
    words += convertLessThanThousand(thousands) + " Thousand ";
    remaining %= 1000;
  }
  
  if (remaining > 0) {
    words += convertLessThanThousand(remaining);
  }
  
  return words.trim() + " Rupees Only";
}

export default function FeeReceiptPrintPage() {
  const params = useParams<{ paymentId: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReceipt = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/fees/receipt/${params.paymentId}`);
      const json = await res.json();
      if (json.success) {
        setReceipt(json.data);
      } else {
        snackbar.show(json.error?.message ?? "Receipt not found", "error");
        router.back();
      }
    } catch {
      snackbar.show("Failed to load receipt details", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.paymentId, router, snackbar]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  useEffect(() => {
    if (receipt) {
      // Set document title for clean PDF saving
      const safeName = `${receipt.student.firstName}_${receipt.student.lastName}`.replace(/[^a-zA-Z0-9_-]/g, "");
      const receiptName = receipt.receiptNo || "Receipt";
      document.title = `Fee_Receipt_${safeName}_${receiptName}`;

      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [receipt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-semibold text-slate-500">
        <Icon name="progress_activity" className="animate-spin text-primary mr-2" size={24} />
        Generating Receipt...
      </div>
    );
  }

  if (!receipt) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-0 md:p-8 flex flex-col items-center print:min-h-0 print:bg-white print:p-0 print:block">
      {/* Control Bar (Hidden during print) */}
      <div className="w-full max-w-[700px] bg-white border border-slate-200 p-4 rounded-xl mb-6 flex justify-between items-center shadow-sm print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 font-semibold cursor-pointer"
        >
          <Icon name="arrow_back" size={16} />
          Go Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 cursor-pointer"
        >
          <Icon name="print" size={16} />
          Print Receipt
        </button>
      </div>

      {/* Printable Receipt Container */}
      <div className="w-full max-w-[700px] bg-white border border-slate-300 p-8 md:p-10 relative flex flex-col justify-between shadow-sm print:border-none print:shadow-none print:max-w-none print:w-full">
        
        {/* Border frame */}
        <div className="absolute inset-4 border border-slate-300 pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Logo & School Header */}
          <div className="text-center space-y-1 pb-4 border-b border-slate-300">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
              {receipt.student.branchName}
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Matoshri Education Society | ERP Portal Fee Receipt
            </p>
          </div>

          {/* Receipt Info Grid */}
          <div className="flex justify-between items-start text-xs font-mono text-slate-700 font-bold border-b border-dashed border-slate-200 pb-4">
            <div className="space-y-1">
              <div>Receipt No: <span className="text-slate-900">{receipt.receiptNo ?? "—"}</span></div>
              <div>Invoice No: <span className="text-slate-900">{receipt.invoice.number}</span></div>
            </div>
            <div className="text-right space-y-1">
              <div>Date: <span className="text-slate-900">{new Date(receipt.paidAt).toLocaleDateString("en-IN")}</span></div>
              <div>Time: <span className="text-slate-900">{new Date(receipt.paidAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}</span></div>
            </div>
          </div>

          {/* Student Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
            <div>
              <span className="block font-bold uppercase tracking-wider text-[9px] text-slate-400">Student Name</span>
              <strong className="text-sm text-slate-950 font-semibold">{receipt.student.firstName} {receipt.student.lastName}</strong>
            </div>
            <div>
              <span className="block font-bold uppercase tracking-wider text-[9px] text-slate-400">Admission Number</span>
              <strong className="text-sm text-slate-950 font-mono font-bold">{receipt.student.admissionNo}</strong>
            </div>
            <div>
              <span className="block font-bold uppercase tracking-wider text-[9px] text-slate-400">Class & Section</span>
              <strong className="text-sm text-slate-950 font-semibold">{receipt.student.className}</strong>
            </div>
            <div>
              <span className="block font-bold uppercase tracking-wider text-[9px] text-slate-400">School Branch</span>
              <strong className="text-sm text-slate-950 font-semibold">{receipt.student.branchName}</strong>
            </div>
          </div>

          {/* Fee Itemization Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mt-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 text-slate-700 font-semibold">
                  <td className="py-3 px-4">Invoice Total ({receipt.invoice.number})</td>
                  <td className="py-3 px-4 text-right">₹{receipt.invoice.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
                {receipt.invoice.paidAmount - receipt.amount > 0 && (
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                    <td className="py-2.5 px-4">Previously Paid</td>
                    <td className="py-2.5 px-4 text-right">₹{(receipt.invoice.paidAmount - receipt.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr className="border-b border-slate-100 text-slate-700 font-semibold">
                  <td className="py-3 px-4">Amount Paid Now</td>
                  <td className="py-3 px-4 text-right">₹{receipt.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
                {receipt.remarks && (
                  <tr className="text-slate-400 italic">
                    <td colSpan={2} className="py-2 px-4 text-[11px]">
                      Remarks: {receipt.remarks}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="py-2.5 px-4 text-right uppercase tracking-wide text-[10px] text-slate-500">Outstanding Balance</td>
                  <td className="py-2.5 px-4 text-right text-sm">₹{receipt.invoice.pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="bg-slate-50/60 rounded-lg p-3 text-xs border border-slate-100">
            <span className="block font-bold uppercase tracking-wider text-[9px] text-slate-400 mb-0.5">Amount in Words</span>
            <span className="font-semibold text-slate-800 italic">{getNumberInWords(receipt.amount)}</span>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4 text-xs border-t border-dashed border-slate-200 pt-4 font-semibold text-slate-600">
            <div>
              <span>Payment Method:</span>{" "}
              <strong className="text-slate-800">{PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method}</strong>
            </div>
            {receipt.transactionId && (
              <div>
                <span>Transaction ID:</span>{" "}
                <strong className="text-slate-800 font-mono">{receipt.transactionId}</strong>
              </div>
            )}
          </div>

          {/* Declaration Statement */}
          <p className="text-[10px] text-slate-400 text-center italic pt-4">
            This is an official computer-generated fee receipt. No physical signature is required.
          </p>
        </div>

        {/* Receipt Footer for Seal & Stamp */}
        <div className="flex justify-between items-end pt-12 relative z-10 text-[11px] font-bold text-slate-800">
          <div className="space-y-4">
            <div className="h-[1px] w-24 bg-slate-300" />
            <div>Received By</div>
          </div>
          <div className="space-y-4 text-right">
            <div className="h-[1px] w-24 bg-slate-300 ml-auto" />
            <div>School Accounts Seal</div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
          }
          .absolute {
            position: absolute !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
