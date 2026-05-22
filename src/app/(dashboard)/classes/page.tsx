"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
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
import { Icon } from "@/components/ui/icon";
import { useBranches } from "@/hooks/use-branches";

interface ClassRow {
  id: string;
  name: string;
  numericGrade: number;
  branch: { id: string; name: string };
  academicYear: { id: string; name: string };
  _count: { sections: number; feeStructures: number };
}

export default function ClassesPage() {
  const router = useRouter();
  const { branches, isLoading: branchesLoading } = useBranches();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ paginated: "true" });
      if (branchFilter && branchFilter !== "__all__") params.set("branchId", branchFilter);

      const res = await fetch(`/api/v1/classes?${params}`);
      const data = await res.json();
      if (data.success) setClasses(data.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [branchFilter]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const columns: Column<ClassRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      key: "numericGrade",
      header: "Grade",
      render: (row) => row.numericGrade,
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => row.branch.name,
    },
    {
      key: "academicYear",
      header: "Academic Year",
      render: (row) => row.academicYear.name,
    },
    {
      key: "sections",
      header: "Sections",
      render: (row) => row._count.sections,
    },
    {
      key: "fees",
      header: "Fees",
      render: (row) => row._count.feeStructures,
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
            <MenuItem onClick={() => router.push(`/classes/${row.id}/edit`)}>
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
            <div className="w-48">
              <Select
                value={branchFilter}
                onValueChange={setBranchFilter}
              >
                <SelectTrigger fullWidth>
                  <SelectValue
                    placeholder={
                      branchesLoading ? "Loading..." : "All branches"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            quickFilter={searchInput}
          />
        </div>
      </div>

      <PermissionGate module="classes" action="create">
        <FAB icon="add" onClick={() => router.push("/classes/new")} />
      </PermissionGate>
    </div>
  );
}
