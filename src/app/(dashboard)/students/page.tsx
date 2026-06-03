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
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useBranches } from "@/hooks/use-branches";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Icon } from "@/components/ui/icon";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  gender: string;
  status: string;
  dateOfBirth: string;
  admissionDate: string;
  fatherPhone: string | null;
  motherPhone: string | null;
  emergencyContact1: string | null;
  totalFees: number;
  totalFeesPaid: number;
  pendingFees: number;
  branch: { id: string; name: string };
  enrollments: Array<{
    rollNo: string | null;
    section: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  }>;
}

const statusColor = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "success" as const;
    case "GRADUATED":
      return "primary" as const;
    case "TRANSFERRED":
    case "DROPPED":
    case "SUSPENDED":
      return "error" as const;
    default:
      return "default" as const;
  }
};

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function StudentAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-label-lg font-medium shrink-0">
      {initials}
    </span>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches } = useBranches();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "9999");
    if (branchFilter !== "ALL") params.set("branchId", branchFilter);

    try {
      const res = await fetch(`/api/v1/students?${params}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [branchFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN")}`;

  const columns: Column<StudentRow>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (row) => `${row.firstName} ${row.lastName}`,
      render: (row) => (
        <div className="flex items-center gap-3">
          <StudentAvatar firstName={row.firstName} lastName={row.lastName} />
          <div>
            <span className="font-medium">
              {row.firstName} {row.lastName}
            </span>
            <p className="text-body-sm text-on-surface-variant">{row.admissionNo}</p>
          </div>
        </div>
      ),
    },
    {
      key: "division",
      header: "Division",
      sortValue: (row) => {
        const enrollment = row.enrollments?.[0];
        if (!enrollment) return null;
        return `${enrollment.section.class.name} - ${enrollment.section.name}`;
      },
      render: (row) => {
        const enrollment = row.enrollments?.[0];
        if (!enrollment) return "—";
        return `${enrollment.section.class.name} - ${enrollment.section.name}`;
      },
    },
    {
      key: "rollNo",
      header: "Roll No",
      render: (row) => row.enrollments?.[0]?.rollNo ?? "—",
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
      key: "dateOfBirth",
      header: "Date of Birth",
      render: (row) =>
        new Date(row.dateOfBirth).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      key: "motherPhone",
      header: "Mother Contact",
      render: (row) => row.motherPhone || "—",
    },
    {
      key: "fatherPhone",
      header: "Father Contact",
      render: (row) => row.fatherPhone || "—",
    },
    {
      key: "emergencyContact",
      header: "Emergency Contact",
      render: (row) => row.emergencyContact1 || "—",
    },
    {
      key: "totalFees",
      header: "Total Fees",
      render: (row) => formatCurrency(row.totalFees),
    },
    {
      key: "totalFeesPaid",
      header: "Collected",
      render: (row) => (
        <span className={row.totalFeesPaid > 0 ? "text-success font-medium" : ""}>
          {formatCurrency(row.totalFeesPaid)}
        </span>
      ),
    },
    {
      key: "pendingFees",
      header: "Remaining",
      render: (row) => (
        <span className={row.pendingFees > 0 ? "text-error font-medium" : ""}>
          {formatCurrency(row.pendingFees)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Chip
          label={statusLabel(row.status)}
          variant="filled"
          color={statusColor(row.status)}
          icon={row.status === "ACTIVE" ? "check_circle" : "cancel"}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
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
                router.push(`/students/${row.id}/edit`);
              }}
            >
              Edit
            </MenuItem>
          </MenuContent>
        </Menu>
      ),
      className: "w-12",
    },
  ];

  return (
    <div>
      <Breadcrumb>
        <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Students</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Students
      </h1>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search students"
              className="sm:max-w-xs"
            />
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
          <PermissionGate module="students" action="create">
            <Button
              variant="filled"
              icon="person_add"
              onClick={() => router.push("/students/new")}
              className="hidden md:inline-flex"
            >
              Add Student
            </Button>
          </PermissionGate>
        </div>

        {/* Table */}
        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={students}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/students/${row.id}/edit`)}
            loading={loading}
            emptyIcon="school"
            emptyMessage="No students found"
            quickFilter={searchInput}
          />
        </div>
      </div>

      <PermissionGate module="students" action="create">
        <FAB icon="person_add" onClick={() => router.push("/students/new")} />
      </PermissionGate>
    </div>
  );
}
