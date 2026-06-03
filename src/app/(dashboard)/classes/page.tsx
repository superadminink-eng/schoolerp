"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { useSnackbar } from "@/components/ui/snackbar";
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
  branch: { id: string; name: string };
  academicYear: { id: string; name: string };
  sections: SectionSummary[];
  totalStudents: number;
  feeStructures: Array<{
    amount: number | string;
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

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ paginated: "true" });
      if (branchFilter && branchFilter !== "__all__")
        params.set("branchId", branchFilter);

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

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/classes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Class deleted");
        fetchClasses();
      } else {
        snackbar.show(data.error?.message ?? "Failed to delete class");
      }
    } catch {
      snackbar.show("An error occurred");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<ClassRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => <span className="font-medium">{row.name}</span>,
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
        const total = row.feeStructures.reduce(
          (sum, f) => sum + Number(f.amount),
          0
        );
        return total > 0 ? `₹${total.toLocaleString("en-IN")}` : "—";
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
            {isSuperAdmin && (
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
            )}
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
