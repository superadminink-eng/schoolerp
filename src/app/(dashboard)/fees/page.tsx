"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SearchBar } from "@/components/ui/search-bar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip } from "@/components/ui/chip";
import { useBranches } from "@/hooks/use-branches";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";

interface FeeRow {
  studentId: string;
  studentName: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  photo: string | null;
  className: string;
  branchName: string;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
  dueDate: string;
}

const statusColor = (status: string) => {
  switch (status) {
    case "PARTIAL":
      return "primary" as const;
    case "OVERDUE":
      return "error" as const;
    case "PENDING":
    default:
      return "default" as const;
  }
};

function StudentAvatar({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-label-lg font-medium shrink-0">
      {initials}
    </span>
  );
}

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN")}`;

export default function FeesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches } = useBranches();

  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const fetchFees = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "9999");
    if (branchFilter !== "ALL") params.set("branchId", branchFilter);

    try {
      const res = await fetch(`/api/v1/fees?${params}`);
      const data = await res.json();
      if (data.success) {
        setFees(data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [branchFilter]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const columns: Column<FeeRow>[] = [
    {
      key: "name",
      header: "Student",
      sortValue: (row) => row.studentName,
      render: (row) => (
        <div className="flex items-center gap-3">
          <StudentAvatar firstName={row.firstName} lastName={row.lastName} />
          <div>
            <span className="font-medium">{row.studentName}</span>
            <p className="text-body-sm text-on-surface-variant">
              {row.admissionNo}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "className",
      header: "Class",
      sortValue: (row) => row.className,
      render: (row) => row.className,
    },
    {
      key: "totalAmount",
      header: "Total",
      sortValue: (row) => row.totalAmount,
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: "paidAmount",
      header: "Paid",
      sortValue: (row) => row.paidAmount,
      render: (row) => (
        <span
          className={row.paidAmount > 0 ? "text-success font-medium" : ""}
        >
          {formatCurrency(row.paidAmount)}
        </span>
      ),
    },
    {
      key: "pendingAmount",
      header: "Pending",
      sortValue: (row) => row.pendingAmount,
      render: (row) => (
        <span className="text-error font-medium">
          {formatCurrency(row.pendingAmount)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortValue: (row) => row.dueDate,
      render: (row) =>
        new Date(row.dueDate).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Chip
          label={row.status}
          variant="filled"
          color={statusColor(row.status)}
        />
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Fees</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Fees Collection
      </h1>

      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search students"
            className="sm:max-w-xs"
          />
          {isSuperAdmin && branches.length > 1 && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={fees}
            keyExtractor={(row) => row.invoiceId}
            onRowClick={(row) => router.push(`/fees/${row.studentId}`)}
            loading={loading}
            emptyIcon="payments"
            emptyMessage="No pending fees found"
            quickFilter={searchInput}
          />
        </div>
      </div>
    </div>
  );
}
