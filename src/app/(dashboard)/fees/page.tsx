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
import { DataTable } from "@/components/ui/lazy-table";
import type { Column } from "@/components/ui/data-table";
import { useBranches } from "@/hooks/use-branches";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { usePermissions } from "@/hooks/use-permissions";
import { Icon } from "@/components/ui/icon";
import { Pagination } from "@/components/ui/pagination";

interface FeeRow {
  studentId: string;
  studentName: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  photo: string | null;
  className: string;
  branchName: string;
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


export default function FeesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches } = useBranches();

  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Sync local branch filter with the global session branch
  useEffect(() => {
    if (session?.user?.branchId) {
      setBranchFilter(session.user.branchId);
    }
  }, [session?.user?.branchId]);

  useEffect(() => {
    setPage(1);
  }, [branchFilter]);

  const fetchFees = useCallback(async () => {
    if (permissionsLoading || !can("fees", "read")) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("page", String(page));
    if (branchFilter !== "ALL") params.set("branchId", branchFilter);

    try {
      const res = await fetch(`/api/v1/fees?${params}`);
      const data = await res.json();
      if (data.success) {
        setFees(data.data);
        setTotal(data.meta?.total ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [branchFilter, page, permissionsLoading, can]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

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

  const columns: Column<FeeRow>[] = [
    {
      key: "name",
      header: "Student",
      sortValue: (row) => row.studentName,
      type: "avatar",
      avatarConfig: {
        firstName: (row) => row.firstName,
        lastName: (row) => row.lastName,
        subtitle: (row) => row.admissionNo,
      },
    },
    {
      key: "className",
      header: "Class",
      sortValue: (row) => row.className,
    },
    {
      key: "totalAmount",
      header: "Total",
      sortValue: (row) => row.totalAmount,
      type: "currency",
      currencyConfig: {
        value: (row) => row.totalAmount,
      },
    },
    {
      key: "paidAmount",
      header: "Paid",
      sortValue: (row) => row.paidAmount,
      type: "currency",
      currencyConfig: {
        value: (row) => row.paidAmount,
        colorVariant: (v) => (v > 0 ? "success" : "default"),
      },
    },
    {
      key: "pendingAmount",
      header: "Pending",
      sortValue: (row) => row.pendingAmount,
      type: "currency",
      currencyConfig: {
        value: (row) => row.pendingAmount,
        colorVariant: "error",
      },
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortValue: (row) => row.dueDate,
      type: "date",
      dateConfig: {
        value: (row) => row.dueDate,
      },
    },
    {
      key: "status",
      header: "Status",
      type: "badge",
      badgeConfig: {
        label: (row) => row.status,
        color: (row) => statusColor(row.status),
      },
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
            keyExtractor={(row) => row.studentId}
            onRowClick={(row) => router.push(`/fees/${row.studentId}`)}
            loading={loading}
            emptyIcon="payments"
            emptyMessage="No pending fees found"
            quickFilter={searchInput}
          />
          <Pagination page={page} limit={100} total={total} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
