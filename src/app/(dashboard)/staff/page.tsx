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
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranches } from "@/hooks/use-branches";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { useSnackbar } from "@/components/ui/snackbar";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
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
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  gender: string | null;
  joinDate: string;
  status: string;
  branch: { id: string; name: string };
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

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "9999");
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (branchFilter !== "ALL") params.set("branchId", branchFilter);

    try {
      const res = await fetch(`/api/v1/staff?${params}`);
      const data = await res.json();
      if (data.success) {
        setStaff(data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [roleFilter, branchFilter]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  async function handleTerminate(id: string) {
    setTerminating(true);
    try {
      const res = await fetch(`/api/v1/staff/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Staff member terminated", "success");
        fetchStaff();
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
      header: "Name",
      type: "avatar",
      avatarConfig: {
        firstName: (row) => row.name,
      },
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.email ?? "—",
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone ?? "—",
    },
    {
      key: "role",
      header: "Role",
      render: (row) => {
        if (!row.role) return "—";
        const label = roleLabel(row.role);
        let iconName = "person";
        if (row.role.includes("TEACHER")) iconName = "school";
        else if (row.role.includes("ACCOUNTANT")) iconName = "payments";
        else if (row.role.includes("LIBRARIAN")) iconName = "menu_book";
        
        return (
          <div className="flex items-center gap-2 text-slate-700 font-medium h-full">
            <Icon name={iconName} size={15} className="text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </div>
        );
      },
    },
    {
      key: "gender",
      header: "Gender",
      render: (row) =>
        row.gender
          ? row.gender.charAt(0) + row.gender.slice(1).toLowerCase()
          : "—",
    },
    {
      key: "joinDate",
      header: "Join Date",
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
            {isSuperAdmin && branches.length > 1 && (
              <Select
                value={branchFilter}
                onValueChange={setBranchFilter}
              >
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
            quickFilter={searchInput}
          />
        </div>
      </div>

      <PermissionGate module="staff" action="create">
        <FAB icon="person_add" onClick={() => router.push("/staff/new")} />
      </PermissionGate>
    </div>
  );
}
