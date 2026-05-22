"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
} from "@/components/ui/menu";
import { Icon } from "@/components/ui/icon";

interface AcademicYearRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AcademicYearsPage() {
  const router = useRouter();
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  const fetchYears = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/academic-years");
      const data = await res.json();
      if (data.success) setYears(data.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  const columns: Column<AcademicYearRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      key: "startDate",
      header: "Start Date",
      render: (row) => formatDate(row.startDate),
    },
    {
      key: "endDate",
      header: "End Date",
      render: (row) => formatDate(row.endDate),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isCurrent ? (
          <Chip label="Current" variant="filled" color="success" />
        ) : (
          <Chip label="Inactive" variant="outlined" color="default" />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <Menu>
          <MenuTrigger asChild>
            <button className="rounded-full p-1 hover:bg-surface-container-high">
              <Icon name="more_vert" size={20} />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onClick={() => router.push(`/academic-years/${row.id}/edit`)}>
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
        <BreadcrumbItem>Academic Years</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Academic Years
      </h1>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search academic years"
            className="sm:max-w-xs"
          />
          <PermissionGate module="academic_years" action="create">
            <Button
              variant="filled"
              icon="add"
              onClick={() => router.push("/academic-years/new")}
              className="hidden md:inline-flex"
            >
              Add Academic Year
            </Button>
          </PermissionGate>
        </div>

        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={years}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/academic-years/${row.id}/edit`)}
            loading={loading}
            emptyIcon="event_busy"
            emptyMessage="No academic years found"
            quickFilter={searchInput}
          />
        </div>
      </div>

      <PermissionGate module="academic_years" action="create">
        <FAB icon="add" onClick={() => router.push("/academic-years/new")} />
      </PermissionGate>
    </div>
  );
}
