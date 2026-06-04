"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/fee-payment";

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
  const columns: Column<Payment>[] = [
    {
      key: "receiptNo",
      header: "Receipt No",
      render: (row) => row.receiptNo ?? "—",
    },
    {
      key: "paidAt",
      header: "Date",
      sortValue: (row) => row.paidAt,
      type: "date",
      dateConfig: {
        value: (row) => row.paidAt,
      },
    },
    {
      key: "amount",
      header: "Amount",
      sortValue: (row) => row.amount,
      type: "currency",
    },
    {
      key: "method",
      header: "Method",
      render: (row) => PAYMENT_METHOD_LABELS[row.method] ?? row.method,
    },
    {
      key: "transactionId",
      header: "Transaction ID",
      render: (row) => row.transactionId || "—",
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (row) => row.remarks || "—",
    },
  ];

  return (
    <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
      <DataTable
        columns={columns}
        data={payments}
        keyExtractor={(row) => row.id}
        emptyIcon="receipt_long"
        emptyMessage="No payments recorded yet"
        paginationPageSize={10}
      />
    </div>
  );
}
