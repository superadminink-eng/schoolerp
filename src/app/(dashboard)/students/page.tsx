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
import { useBranches } from "@/hooks/use-branches";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { Pagination } from "@/components/ui/pagination";


interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  gender: string;
  status: string;
  house: string | null;
  category: string;
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


export default function StudentsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const { branches } = useBranches();

  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");

  // Advanced Filters
  const [classes, setClasses] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState("ALL");
  const [sections, setSections] = useState<any[]>([]);
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [houseFilter, setHouseFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 20;

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
  }, [searchInput, branchFilter, classFilter, sectionFilter, statusFilter, houseFilter, categoryFilter]);

  // Derive active branch ID
  const activeBranchId = branchFilter !== "ALL" 
    ? branchFilter 
    : (session?.user?.branchId || "");

  // Load Classes when active branch changes
  useEffect(() => {
    if (activeBranchId) {
      fetch(`/api/v1/classes?branchId=${activeBranchId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setClasses(data.data);
          }
        })
        .catch(() => {});
    } else {
      setClasses([]);
    }
    setClassFilter("ALL");
    setSectionFilter("ALL");
    setSections([]);
  }, [activeBranchId]);

  // Load Sections when class changes
  useEffect(() => {
    if (classFilter !== "ALL") {
      fetch(`/api/v1/classes/${classFilter}/sections`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSections(data.data);
          }
        })
        .catch(() => {});
    } else {
      setSections([]);
    }
    setSectionFilter("ALL");
  }, [classFilter]);

  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("limit", limit.toString());
  if (searchInput) params.set("search", searchInput);
  if (branchFilter !== "ALL") params.set("branchId", branchFilter);
  if (classFilter !== "ALL") params.set("classId", classFilter);
  if (sectionFilter !== "ALL") params.set("sectionId", sectionFilter);
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (houseFilter !== "ALL") params.set("house", houseFilter);
  if (categoryFilter !== "ALL") params.set("category", categoryFilter);

  const { data: apiResponse, isLoading: loading } = useApi<StudentRow[]>(
    `/api/v1/students?${params.toString()}`
  );

  const students = apiResponse?.data ?? [];
  const totalItems = apiResponse?.meta?.total ?? 0;
  const stats = apiResponse?.meta?.stats ?? { active: 0, rte: 0, inactive: 0 };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN")}`;

  const columns: Column<StudentRow>[] = [
    {
      key: "name",
      header: "Name",
      minWidth: 200,
      sortValue: (row) => `${row.firstName} ${row.lastName}`,
      type: "avatar",
      avatarConfig: {
        firstName: (row) => row.firstName,
        lastName: (row) => row.lastName,
        subtitle: (row) => row.admissionNo,
      },
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
      type: "date",
      dateConfig: {
        value: (row) => row.dateOfBirth,
      },
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
      type: "currency",
      currencyConfig: {
        value: (row) => row.totalFees,
      },
    },
    {
      key: "totalFeesPaid",
      header: "Collected",
      type: "currency",
      currencyConfig: {
        value: (row) => row.totalFeesPaid,
        colorVariant: (v) => (v > 0 ? "success" : "default"),
      },
    },
    {
      key: "pendingFees",
      header: "Remaining",
      type: "currency",
      currencyConfig: {
        value: (row) => row.pendingFees,
        colorVariant: (v) => (v > 0 ? "error" : "default"),
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
          if (row.status === "GRADUATED") return "warning";
          if (["TRANSFERRED", "DROPPED", "SUSPENDED"].includes(row.status)) return "error";
          return "default";
        },
      },
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

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-300">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <Icon name="group" size={24} />
          </div>
          <div>
            <div className="text-body-sm text-on-surface-variant font-semibold">Total Students</div>
            <div className="text-headline-md font-black text-on-surface">{totalItems}</div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-300">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Icon name="check_circle" size={24} />
          </div>
          <div>
            <div className="text-body-sm text-on-surface-variant font-semibold">Active</div>
            <div className="text-headline-md font-black text-on-surface">{stats.active}</div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-300">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <Icon name="star" size={24} />
          </div>
          <div>
            <div className="text-body-sm text-on-surface-variant font-semibold">RTE Category</div>
            <div className="text-headline-md font-black text-on-surface">{stats.rte}</div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-300">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
            <Icon name="person_off" size={24} />
          </div>
          <div>
            <div className="text-body-sm text-on-surface-variant font-semibold">Inactive / Dropped</div>
            <div className="text-headline-md font-black text-on-surface">{stats.inactive}</div>
          </div>
        </div>
      </div>

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
             <Button
              variant="outlined"
              icon="tune"
              data-testid="filter-button"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-primary/5 text-primary border-primary/30" : "bg-white"}
            >
              Filters
            </Button>
          </div>
          <PermissionGate module="students" action="update">
            <Button
              variant="tonal"
              icon="bolt"
              onClick={() => router.push("/students/promote")}
              className="hidden md:inline-flex bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200"
            >
              Bulk Promotion
            </Button>
          </PermissionGate>
          <PermissionGate module="admissions" action="registrar_desk">
            <Button
              variant="tonal"
              icon="arrow_forward"
              onClick={() => router.push("/admissions")}
              className="hidden md:inline-flex"
            >
              New Intake / Admission
            </Button>
          </PermissionGate>
        </div>

        {/* Collapsible Advanced Filters Row */}
        {showFilters && (
          <Card className="border border-outline-variant/60 bg-slate-50/40 shadow-none p-5 rounded-2xl">
            <CardContent className="p-0 grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Class Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Class</label>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Section</label>
                <Select
                  value={sectionFilter}
                  onValueChange={setSectionFilter}
                  disabled={classFilter === "ALL"}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Sections</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* House Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">House</label>
                <Select value={houseFilter} onValueChange={setHouseFilter}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Houses</SelectItem>
                    <SelectItem value="Red">Red</SelectItem>
                    <SelectItem value="Blue">Blue</SelectItem>
                    <SelectItem value="Green">Green</SelectItem>
                    <SelectItem value="Yellow">Yellow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="RTE">RTE</SelectItem>
                    <SelectItem value="SCHOLARSHIP">Scholarship</SelectItem>
                    <SelectItem value="STAFF_CHILD">Staff Child</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1 col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="GRADUATED">Graduated</SelectItem>
                    <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                    <SelectItem value="DROPPED">Dropped</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Count Indicator */}
        <div className="flex items-center text-sm font-medium text-slate-600">
          {loading ? (
            <span className="animate-pulse">Calculating...</span>
          ) : (
            <span>
              Results found: <strong className="text-slate-900 bg-slate-200 px-2 py-0.5 rounded-md ml-1">{totalItems}</strong>
            </span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={students}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => {
              console.log("ROW CLICKED, REDIRECTING TO:", `/students/${row.id}`);
              router.push(`/students/${row.id}`);
            }}
            loading={loading}
            emptyIcon="school"
            emptyMessage="No students found"
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

      <PermissionGate module="admissions" action="registrar_desk">
        <FAB icon="arrow_forward" onClick={() => router.push("/admissions")} />
      </PermissionGate>
    </div>
  );
}
