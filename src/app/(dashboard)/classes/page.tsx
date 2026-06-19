"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable } from "@/components/ui/lazy-table";
import type { Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { useSnackbar } from "@/components/ui/snackbar";
import { useApi } from "@/hooks/use-api";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@/components/ui/menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useBranches } from "@/hooks/use-branches";

interface SectionSummary {
  id: string;
  name: string;
  classTeacher?: { id: string; name: string } | null;
}

interface ClassRow {
  id: string;
  name: string;
  numericGrade: number;
  status: "DRAFT" | "ACTIVE";
  branch: { id: string; name: string };
  academicYear: { id: string; name: string };
  sections: SectionSummary[];
  totalStudents: number;
  feeStructures: Array<{
    amount: number | string;
    termType?: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
    feeCategory: { name: string };
  }>;
  _count: { sections: number; subjects: number };
}

export default function ClassesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const snackbar = useSnackbar();
  const { can } = usePermissions();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches, isLoading: branchesLoading } = useBranches();

  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [deleting, setDeleting] = useState(false);

  // Sync local branch filter with the global session branch
  useEffect(() => {
    if (session?.user?.branchId) {
      setBranchFilter(session.user.branchId);
    } else if (session?.user && !session.user.branchId) {
      setBranchFilter("__all__");
    }
  }, [session?.user?.branchId, session?.user]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchInput, branchFilter]);

  const shouldFetch = branchFilter !== "";
  const params = new URLSearchParams();
  params.set("paginated", "true");
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  if (searchInput) params.set("search", searchInput);
  if (branchFilter && branchFilter !== "__all__") {
    params.set("branchId", branchFilter);
  }

  const { data: apiResponse, isLoading: loading, mutate } = useApi<ClassRow[]>(
    shouldFetch ? `/api/v1/classes?${params.toString()}` : null
  );

  const classes = apiResponse?.data ?? [];
  const totalItems = apiResponse?.meta?.total ?? 0;

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/classes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Class deleted", "success");
        mutate();
      } else {
        snackbar.show(data.error?.message ?? "Failed to delete class", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<ClassRow>[] = [
    {
      key: "name",
      header: "Name",
    },
    {
      key: "numericGrade",
      header: "Grade",
      render: (row) => row.numericGrade,
    },
    {
      key: "academicYear",
      header: "Academic Year",
      render: (row) => row.academicYear.name,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const isDraft = row.status === "DRAFT";
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isDraft
                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
            }`}
          >
            {isDraft ? "Draft" : "Active"}
          </span>
        );
      },
    },
    {
      key: "subjects",
      header: "Subjects",
      render: (row) => row._count.subjects,
    },
    {
      key: "divisions",
      header: "Divisions",
      render: (row) => {
        const summary = row.sections
          .map(
            (s) => `${s.name}${s.classTeacher ? ` (${s.classTeacher.name})` : ""}`
          )
          .join(", ");
        return (
          <span title={summary}>
            {row._count.sections}
          </span>
        );
      },
    },
    {
      key: "students",
      header: "Students",
      render: (row) => row.totalStudents,
    },
    {
      key: "fees",
      header: "Fees",
      render: (row) => {
        const termTotals: Record<string, number> = {};
        for (const f of row.feeStructures) {
          const t = f.termType || "FULL_TERM";
          termTotals[t] = (termTotals[t] || 0) + Number(f.amount);
        }

        const termOrder: Record<string, number> = {
          FULL_TERM: 1,
          HALF_TERM: 2,
          SHORT_TERM: 3,
        };

        const terms = Object.entries(termTotals).sort((a, b) => {
          return (termOrder[a[0]] || 99) - (termOrder[b[0]] || 99);
        });

        const termLabels: Record<string, string> = {
          FULL_TERM: "Full",
          HALF_TERM: "Half",
          SHORT_TERM: "Short",
        };

        if (terms.length === 0) {
          return (
            <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 ring-1 ring-inset ring-slate-600/10 dark:ring-slate-400/20">
              ₹0
            </span>
          );
        }

        const tooltipText = terms
          .map(([termType, amount]) => {
            const label = termLabels[termType] || termType;
            return `${label}: ₹${amount.toLocaleString("en-IN")}`;
          })
          .join("\n");

        const [primaryTermType, primaryAmount] = terms[0];
        const primaryLabel = termLabels[primaryTermType] || primaryTermType;

        return (
          <div className="flex items-center gap-1.5" title={tooltipText}>
            <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-600/10 dark:ring-slate-400/20 whitespace-nowrap">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mr-1 uppercase font-bold tracking-wider">
                {primaryLabel}
              </span>
              ₹{primaryAmount.toLocaleString("en-IN")}
            </span>
            {terms.length > 1 && (
              <span 
                className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-1 text-[10px] font-black text-primary ring-1 ring-inset ring-primary/20 cursor-help whitespace-nowrap"
                title={tooltipText}
              >
                +{terms.length - 1}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <Dialog>
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-surface-container-high"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="more_vert" size={20} />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon="edit"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/classes/${row.id}/edit`);
                }}
              >
                Edit
              </MenuItem>
              {can("classes", "delete") && (
                <DialogTrigger asChild>
                  <MenuItem
                    icon="delete"
                    onClick={(e) => e.stopPropagation()}
                    className="text-error"
                  >
                    Delete
                  </MenuItem>
                </DialogTrigger>
              )}
            </MenuContent>
          </Menu>
          <DialogContent>
            <DialogTitle>Delete class?</DialogTitle>
            <DialogDescription>
              This will permanently delete the class &ldquo;{row.name}&rdquo;
              along with its divisions, subjects, and fee structures. If
              students are enrolled, deletion will be refused.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="text">Cancel</Button>
              </DialogClose>
              <Button
                variant="filled"
                onClick={() => handleDelete(row.id)}
                loading={deleting}
                className="bg-error text-on-error"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ),
      className: "w-12",
    },
  ];

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Classes</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Classes
      </h1>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search classes"
              className="sm:max-w-xs"
            />
          </div>
          <PermissionGate module="classes" action="create">
            <Button
              variant="filled"
              icon="add"
              onClick={() => router.push("/classes/new")}
              className="hidden md:inline-flex"
            >
              Add Class
            </Button>
          </PermissionGate>
        </div>

        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={classes}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/classes/${row.id}/edit`)}
            loading={loading}
            emptyIcon="class"
            emptyMessage="No classes found"
          />
        </div>

        <Pagination
          currentPage={page}
          totalItems={totalItems}
          itemsPerPage={limit}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      <PermissionGate module="classes" action="create">
        <FAB icon="add" onClick={() => router.push("/classes/new")} />
      </PermissionGate>
    </div>
  );
}
