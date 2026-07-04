"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchBar } from "@/components/ui/search-bar";
import { DataTable } from "@/components/ui/lazy-table";
import type { Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip } from "@/components/ui/chip";
import { PermissionGate } from "@/components/shared/permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { FAB } from "@/components/ui/fab";
import { useSnackbar } from "@/components/ui/snackbar";
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
import { DepartmentMasterDialog } from "@/components/departments/department-master-dialog";

interface DepartmentMasterRow {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
}

export default function DepartmentsPage() {
  const snackbar = useSnackbar();
  const { can } = usePermissions();

  const [departments, setDepartments] = useState<DepartmentMasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingDepartment, setEditingDepartment] = useState<DepartmentMasterRow | null>(
    null
  );

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const url = showInactive 
        ? "/api/v1/departments?active=false" 
        : "/api/v1/departments";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setDepartments(data.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  function openCreate() {
    setDialogMode("create");
    setEditingDepartment(null);
    setDialogOpen(true);
  }

  function openEdit(department: DepartmentMasterRow) {
    setDialogMode("edit");
    setEditingDepartment(department);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/departments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Department deleted permanently", "success");
        fetchDepartments();
      } else {
        snackbar.show(data.error?.message ?? "Failed to delete department", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore(id: string) {
    try {
      const res = await fetch(`/api/v1/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Department restored successfully", "success");
        fetchDepartments();
      } else {
        snackbar.show(data.error?.message ?? "Failed to restore department", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    }
  }

  const columns: Column<DepartmentMasterRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className={!row.isActive ? "text-on-surface-variant line-through opacity-70" : "font-medium"}>
            {row.name}
          </span>
          {!row.isActive && (
            <Chip label="Archived" color="default" className="h-6 text-[10px] uppercase font-bold tracking-wider" />
          )}
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-on-surface-variant text-body-sm line-clamp-1">
          {row.description || "—"}
        </span>
      ),
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
              {can("departments", "update") && (
                <MenuItem
                  icon="edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(row);
                  }}
                >
                  Edit
                </MenuItem>
              )}
              {can("departments", "delete") && (
                <>
                  {row.isActive ? (
                    <DialogTrigger asChild>
                      <MenuItem
                        icon="delete"
                        onClick={(e) => e.stopPropagation()}
                        className="text-error"
                      >
                        Delete
                      </MenuItem>
                    </DialogTrigger>
                  ) : (
                    <MenuItem
                      icon="restore"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(row.id);
                      }}
                    >
                      Restore
                    </MenuItem>
                  )}
                </>
              )}
            </MenuContent>
          </Menu>
          <DialogContent>
            <DialogTitle>Delete department?</DialogTitle>
            <DialogDescription>
              This will permanently delete the department &ldquo;{row.name}&rdquo;.
              If it is assigned to any staff members, deletion will be blocked to preserve historical record integrity.
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
        <BreadcrumbItem href="/staff">Staff</BreadcrumbItem>
        <BreadcrumbItem>Departments</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">
          Departments Catalog
        </h1>
        <p className="text-body-sm text-on-surface-variant">
          Manage staff academic and administrative departments across the school
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search departments"
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <label className="text-body-sm text-on-surface-variant cursor-pointer" onClick={() => setShowInactive(!showInactive)}>
                Show Inactive
              </label>
            </div>
          </div>
          <PermissionGate module="departments" action="create">
            <Button
              variant="filled"
              icon="add"
              onClick={openCreate}
              className="hidden md:inline-flex"
            >
              Add Department
            </Button>
          </PermissionGate>
        </div>

        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={departments}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => {
              if (can("departments", "update")) {
                openEdit(row);
              }
            }}
            loading={loading}
            quickFilter={searchInput}
            getRowClass={(params) => (!params.data?.isActive ? "opacity-60 bg-surface-container-lowest" : "")}
            emptyIcon="domain"
            emptyMessage="No departments found"
          />
        </div>
      </div>

      <PermissionGate module="departments" action="create">
        <FAB icon="add" onClick={openCreate} />
      </PermissionGate>

      <DepartmentMasterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initialData={editingDepartment}
        onSuccess={fetchDepartments}
      />
    </div>
  );
}
