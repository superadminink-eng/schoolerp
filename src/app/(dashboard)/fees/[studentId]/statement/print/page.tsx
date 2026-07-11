"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSnackbar } from "@/components/ui/snackbar";
import { Icon } from "@/components/ui/icon";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/fee-payment";

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

export default function FeeStatementPrintPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const snackbar = useSnackbar();

  const [data, setData] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatement = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/fees/${params.studentId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        snackbar.show(json.error?.message ?? "Student not found", "error");
        router.back();
      }
    } catch {
      snackbar.show("Failed to load fee statement", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.studentId, router, snackbar]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  useEffect(() => {
    if (data) {
      // Set document title for clean PDF saving
      const safeName = `${data.student.firstName}_${data.student.lastName}`.replace(/[^a-zA-Z0-9_-]/g, "");
      document.title = `Account_Statement_${safeName}`;

      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-semibold text-slate-500">
        <Icon name="progress_activity" className="animate-spin text-primary mr-2" size={24} />
        Generating Account Statement...
      </div>
    );
  }

  if (!data) return null;

  const { student, invoices, payments } = data;

  const totalFeeAll = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPaidAll = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalPendingAll = invoices.reduce((sum, inv) => sum + inv.pendingAmount, 0);

  return (
    <div className="min-h-screen bg-slate-50/50 p-0 md:p-8 flex flex-col items-center">
      {/* Control Bar (Hidden during print) */}
      <div className="w-full max-w-[800px] bg-white border border-slate-200 p-4 rounded-xl mb-6 flex justify-between items-center shadow-sm no-print">
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
          Print Statement
        </button>
      </div>

      {/* Printable Statement Container */}
      <div className="w-full max-w-[800px] bg-white border border-slate-300 p-10 relative print-container flex flex-col justify-between shadow-sm min-h-[1050px]">
        
        {/* Border frame */}
        <div className="absolute inset-4 border border-slate-300 pointer-events-none" />

        <div className="space-y-6 relative z-10">
          
          {/* Header */}
          <div className="text-center space-y-1 pb-5 border-b border-slate-300">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
              {student.branchName}
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Statement of Account (Fees & Payments Ledger)
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              Generated Date: {new Date().toLocaleDateString("en-IN")}
            </p>
          </div>

          {/* Student Profile Info */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Student Name</span>
              <strong className="text-slate-800 text-sm font-semibold">{student.firstName} {student.lastName}</strong>
            </div>
            <div>
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Admission No</span>
              <strong className="text-slate-800 text-sm font-mono font-bold">{student.admissionNo}</strong>
            </div>
            <div>
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Class & Section</span>
              <strong className="text-slate-800 text-sm font-semibold">{student.className ?? "—"}</strong>
            </div>
            <div>
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Branch</span>
              <strong className="text-slate-800 text-sm font-semibold">{student.branchName}</strong>
            </div>
          </div>

          {/* Financial Summary KPI Cards */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border border-slate-200 p-3.5 rounded-xl bg-white">
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Total Fees</span>
              <strong className="text-base font-black text-slate-700">₹{totalFeeAll.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="border border-slate-200 p-3.5 rounded-xl bg-white">
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Total Paid</span>
              <strong className="text-base font-black text-emerald-600">₹{totalPaidAll.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="border border-slate-200 p-3.5 rounded-xl bg-white">
              <span className="block font-bold text-slate-400 uppercase text-[9px] tracking-wider">Outstanding Balance</span>
              <strong className={`text-base font-black ${totalPendingAll > 0 ? "text-rose-600 animate-pulse" : "text-emerald-600"}`}>
                ₹{totalPendingAll.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* Table 1: Installment Details */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-l-2 border-slate-800 pl-2">
              Installment Schedule Details
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2 px-3">Installment Name</th>
                    <th className="py-2 px-3">Invoice No</th>
                    <th className="py-2 px-3">Due Date</th>
                    <th className="py-2 px-3 text-right">Total Amount</th>
                    <th className="py-2 px-3 text-right">Paid</th>
                    <th className="py-2 px-3 text-right">Pending</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, idx) => {
                    const isOverdue = inv.status !== "PAID" && new Date(inv.dueDate) < new Date();
                    return (
                      <tr key={inv.id} className="border-b border-slate-100 text-slate-700">
                        <td className="py-2 px-3 font-semibold">Installment #{idx + 1}</td>
                        <td className="py-2 px-3 font-mono">{inv.number}</td>
                        <td className="py-2 px-3">{new Date(inv.dueDate).toLocaleDateString("en-IN")}</td>
                        <td className="py-2 px-3 text-right">₹{inv.totalAmount.toLocaleString("en-IN")}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">₹{inv.paidAmount.toLocaleString("en-IN")}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${inv.pendingAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          ₹{inv.pendingAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            inv.status === "PAID" ? "bg-emerald-50 text-emerald-700" : isOverdue ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"
                          }`}>
                            {isOverdue ? "OVERDUE" : inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Payment History */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-l-2 border-slate-800 pl-2">
              Payment Transactions History Ledger
            </h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2 px-3">Receipt No</th>
                    <th className="py-2 px-3">Payment Date</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Transaction ID</th>
                    <th className="py-2 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? (
                    payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 text-slate-700">
                        <td className="py-2 px-3 font-semibold font-mono text-slate-900">{p.receiptNo ?? "—"}</td>
                        <td className="py-2 px-3">{new Date(p.paidAt).toLocaleDateString("en-IN")}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 font-bold">₹{p.amount.toLocaleString("en-IN")}</td>
                        <td className="py-2 px-3">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{p.transactionId || "—"}</td>
                        <td className="py-2 px-3 italic text-slate-500">{p.remarks || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 font-medium italic">
                        No payments recorded yet for this student.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification Statement */}
          <p className="text-[10px] text-slate-400 text-center italic pt-4">
            This account statement represents a true and accurate reflection of outstanding dues and receipts recorded as of the generation date.
          </p>
        </div>

        {/* Statement Footer */}
        <div className="flex justify-between items-end pt-12 relative z-10 text-[11px] font-bold text-slate-800">
          <div className="space-y-4">
            <div className="h-[1px] w-28 bg-slate-300" />
            <div>Prepared By (Accounts)</div>
          </div>
          <div className="space-y-4 text-right">
            <div className="h-[1px] w-28 bg-slate-300 ml-auto" />
            <div>Authorized Officer Sign / Seal</div>
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
