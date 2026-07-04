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
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranches } from "@/hooks/use-branches";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { useSnackbar } from "@/components/ui/snackbar";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { useApi } from "@/hooks/use-api";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";


const ROLE_OPTIONS = [
  { value: "ALL", label: "All Roles" },
  { value: "TEACHER", label: "Teacher" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "COUNSELOR", label: "Counselor" },
  { value: "TRANSPORT_MANAGER", label: "Transport Manager" },
];

interface StaffRow {
  id: string;
  employeeId?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  gender: string | null;
  joinDate: string;
  status: string;
  staffType: "TEACHING" | "NON_TEACHING";
  branch: { id: string; name: string };
  departmentMaster?: { id: string; name: string; code: string } | null;
  staffDesignations?: { designation: { id: string; name: string; code: string } }[];
}

const roleLabel = (role: string) =>
  role
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const statusColor = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "success" as const;
    case "ON_LEAVE":
      return "warning" as const;
    case "RESIGNED":
    case "TERMINATED":
      return "error" as const;
    default:
      return "default" as const;
  }
};

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());



export default function StaffPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const snackbar = useSnackbar();
  const { can } = usePermissions();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches } = useBranches();

  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [staffTypeFilter, setStaffTypeFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [terminating, setTerminating] = useState(false);

  // Sync local branch filter with the global session branch
  useEffect(() => {
    if (session?.user?.branchId) {
      setBranchFilter(session.user.branchId);
    } else if (session?.user && !session.user.branchId) {
      setBranchFilter("ALL");
    }
  }, [session?.user?.branchId, session?.user]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchInput, roleFilter, staffTypeFilter, branchFilter]);

  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  if (searchInput) params.set("search", searchInput);
  if (roleFilter !== "ALL") params.set("role", roleFilter);
  if (staffTypeFilter !== "ALL") params.set("staffType", staffTypeFilter);
  if (branchFilter !== "ALL") params.set("branchId", branchFilter);

  const { data: apiResponse, isLoading: loading, mutate } = useApi<StaffRow[]>(
    `/api/v1/staff?${params.toString()}`
  );

  const staff = apiResponse?.data ?? [];
  const totalItems = apiResponse?.meta?.total ?? 0;

  async function handleTerminate(id: string) {
    setTerminating(true);
    try {
      const res = await fetch(`/api/v1/staff/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Staff member terminated", "success");
        mutate();
      } else {
        snackbar.show(data.error?.message ?? "Failed to terminate staff member", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setTerminating(false);
    }
  }

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: "Staff Member",
      type: "avatar",
      avatarConfig: {
        firstName: (row) => row.name,
        subtitle: (row) => {
          const dept = row.departmentMaster?.name ? `${row.departmentMaster.name} Dept` : (row.staffType === "TEACHING" ? "Teaching" : "Non-Teaching");
          const shortId = row.employeeId ? (row.employeeId.includes("-") ? `#${row.employeeId.split("-").slice(-1)[0]}` : `#${row.employeeId}`) : null;
          return [dept, shortId].filter(Boolean).join(" • ");
        },
      },
    },
    {
      key: "role",
      header: "Role & Title",
      render: (row) => {
        const desigs = row.staffDesignations?.map((sd) => sd.designation.name) || [];
        if (desigs.length > 0) {
          return (
            <div className="flex flex-wrap items-center gap-1.5 py-1">
              {desigs.map((dName, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-tight bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-900 dark:from-amber-500/20 dark:to-orange-500/20 dark:text-amber-300 border border-amber-500/30 shadow-sm"
                >
                  <Icon name="workspace_premium" size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{dName}</span>
                </div>
              ))}
            </div>
          );
        }

        if (!row.role) return "—";
        const label = roleLabel(row.role);
        let iconName = "person";
        if (row.role.includes("TEACHER")) iconName = "school";
        else if (row.role.includes("ACCOUNTANT")) iconName = "payments";
        else if (row.role.includes("LIBRARIAN")) iconName = "menu_book";
        
        return (
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-medium py-1">
            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 shrink-0">
              <Icon name={iconName} size={14} />
            </div>
            <span className="text-sm font-semibold">{label}</span>
          </div>
        );
      },
    },
    {
      key: "contact",
      header: "Contact Info",
      render: (row) => (
        <div className="flex flex-col gap-1 py-1">
          {row.phone ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200">
              <Icon name="phone" size={13} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <span>{row.phone}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">— No phone —</span>
          )}
          {row.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <Icon name="mail" size={13} className="text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="truncate max-w-[180px]">{row.email}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "staffType",
      header: "Category",
      render: (row) => {
        if (!row.staffType) return "—";
        const isTeaching = row.staffType === "TEACHING";
        return (
          <span className={cn(
            "px-2.5 py-1 text-xs font-semibold rounded-full",
            isTeaching ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
          )}>
            {isTeaching ? "Teaching" : "Non-Teaching"}
          </span>
        );
      },
    },
    {
      key: "joinDate",
      header: "Joined",
      type: "date",
      dateConfig: {
        value: (row) => row.joinDate,
      },
    },
    {
      key: "status",
      header: "Status",
      type: "status-dot",
      statusDotConfig: {
        label: (row) => statusLabel(row.status),
        color: (row) => {
          if (row.status === "ACTIVE") return "success";
          if (row.status === "ON_LEAVE") return "warning";
          if (row.status === "RESIGNED" || row.status === "TERMINATED") return "error";
          return "default";
        },
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
                className="rounded-full p-1 hover:bg-on-surface/8 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="more_vert" size={20} className="text-on-surface-variant" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon="edit"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/staff/${row.id}/edit`);
                }}
              >
                Edit
              </MenuItem>
              {can("staff", "delete") && row.status !== "TERMINATED" && (
                <DialogTrigger asChild>
                  <MenuItem
                    icon="person_off"
                    onClick={(e) => e.stopPropagation()}
                    className="text-error"
                  >
                    Terminate
                  </MenuItem>
                </DialogTrigger>
              )}
            </MenuContent>
          </Menu>
          <DialogContent>
            <DialogTitle>Terminate staff member?</DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate &ldquo;{row.name}&rdquo;?
              This will mark them as terminated.
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="text">Cancel</Button>
              </DialogClose>
              <Button
                variant="filled"
                onClick={() => handleTerminate(row.id)}
                loading={terminating}
                className="bg-error text-on-error"
              >
                Terminate
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
        <BreadcrumbItem>Staff</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Staff
      </h1>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search staff"
              className="sm:max-w-xs"
            />
            <Select
              value={roleFilter}
              onValueChange={setRoleFilter}
            >
              <SelectTrigger className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={staffTypeFilter}
              onValueChange={setStaffTypeFilter}
            >
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="TEACHING">Teaching</SelectItem>
                <SelectItem value="NON_TEACHING">Non-Teaching</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PermissionGate module="staff" action="create">
            <Button
              variant="filled"
              icon="person_add"
              onClick={() => router.push("/staff/new")}
              className="hidden md:inline-flex"
            >
              Add Staff
            </Button>
          </PermissionGate>
        </div>

        {/* Table */}
        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={staff}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/staff/${row.id}/edit`)}
            loading={loading}
            emptyIcon="group_off"
            emptyMessage="No staff members found"
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

      <PermissionGate module="staff" action="create">
        <FAB icon="person_add" onClick={() => router.push("/staff/new")} />
      </PermissionGate>
    </div>
  );
}
