"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/ui/lazy-table";
import type { Column } from "@/components/ui/data-table";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/fee-payment";
import { Icon } from "@/components/ui/icon";

interface Payment {
  id: string;
  receiptNo: string | null;
  amount: number;
  method: string;
  transactionId: string | null;
  paidAt: string;
  remarks: string | null;
}

interface PaymentHistoryProps {
  payments: Payment[];
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  // Aggregate multiple installments into a single Transaction/Receipt
  const aggregatedPayments = useMemo(() => {
    const map = new Map<string, Payment & { allReceiptNos: string[] }>();
    
    payments.forEach((p) => {
      // Group strictly by transactionId first to handle legacy multi-receipt transactions.
      const key = p.transactionId || p.receiptNo || p.id;
      if (!map.has(key)) {
        map.set(key, { 
          ...p, 
          amount: Number(p.amount),
          allReceiptNos: p.receiptNo ? [p.receiptNo] : []
        });
      } else {
        const existing = map.get(key)!;
        existing.amount += Number(p.amount);
        if (p.receiptNo && !existing.allReceiptNos.includes(p.receiptNo)) {
          existing.allReceiptNos.push(p.receiptNo);
        }
      }
    });

    // Sort by paidAt descending
    return Array.from(map.values()).sort((a, b) => {
      return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
    });
  }, [payments]);

  const columns: Column<Payment & { allReceiptNos: string[] }>[] = [
    {
      key: "receiptNo",
      header: "Receipt No",
      minWidth: 160,
      render: (row) => {
        if (row.allReceiptNos.length === 0) return <span className="text-slate-400">—</span>;
        
        if (row.allReceiptNos.length === 1) {
          return (
            <span className="font-semibold text-[13px] text-slate-800 dark:text-slate-200">
              {row.allReceiptNos[0]}
            </span>
          );
        }

        return (
          <div className="flex flex-col">
            <span className="font-semibold text-[13px] text-slate-800 dark:text-slate-200 leading-tight">
              {row.allReceiptNos[0]}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              +{row.allReceiptNos.length - 1} more
            </span>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Total Amount",
      minWidth: 120,
      render: (row) => (
        <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
          ₹{row.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      minWidth: 100,
      render: (row) => {
        const label = PAYMENT_METHOD_LABELS[row.method as any] ?? row.method;
        return (
          <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
            {label}
          </span>
        );
      },
    },
    {
      key: "transactionId",
      header: "Transaction ID",
      minWidth: 200,
      render: (row) => {
        if (!row.transactionId) return <span className="text-slate-400">—</span>;
        
        return (
          <div className="group flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
              {row.transactionId}
            </span>
            <button
              type="button"
              title="Copy Transaction ID"
              onClick={() => navigator.clipboard.writeText(row.transactionId || "")}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity flex items-center"
            >
              <Icon name="copy" size={13} />
            </button>
          </div>
        );
      },
    },
    {
      key: "paidAt",
      header: "Date",
      minWidth: 120,
      render: (row) => {
        const d = new Date(row.paidAt);
        if (isNaN(d.getTime())) return "—";
        return (
          <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
            {d.toLocaleDateString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-12 text-center",
      minWidth: 60,
      render: (row) => (
        <div className="flex items-center justify-end pr-2">
          <button
            type="button"
            title="Print Receipt"
            onClick={() => window.open(`/fees/receipt/${row.transactionId || row.allReceiptNos[0] || row.id}/print`, "_blank")}
            className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center justify-center p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Icon name="print" size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950/50 overflow-hidden shadow-sm">
      <DataTable
        columns={columns}
        data={aggregatedPayments}
        keyExtractor={(row) => row.transactionId || row.allReceiptNos[0] || row.id}
        emptyIcon="receipt_long"
        emptyMessage="No payments recorded yet"
        paginationPageSize={10}
      />
    </div>
  );
}
