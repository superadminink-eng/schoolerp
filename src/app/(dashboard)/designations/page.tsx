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
import { DesignationMasterDialog } from "@/components/designations/designation-master-dialog";

interface DesignationMasterRow {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
}

export default function DesignationsPage() {
  const snackbar = useSnackbar();
  const { can } = usePermissions();

  const [designations, setDesignations] = useState<DesignationMasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingDesignation, setEditingDesignation] = useState<DesignationMasterRow | null>(
    null
  );

  const fetchDesignations = useCallback(async () => {
    setLoading(true);
    try {
      const url = showInactive 
        ? "/api/v1/designations?active=false" 
        : "/api/v1/designations";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setDesignations(data.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchDesignations();
  }, [fetchDesignations]);

  function openCreate() {
    setDialogMode("create");
    setEditingDesignation(null);
    setDialogOpen(true);
  }

  function openEdit(designation: DesignationMasterRow) {
    setDialogMode("edit");
    setEditingDesignation(designation);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/designations/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Designation deleted permanently", "success");
        fetchDesignations();
      } else {
        snackbar.show(data.error?.message ?? "Failed to delete designation", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore(id: string) {
    try {
      const res = await fetch(`/api/v1/designations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Designation restored successfully", "success");
        fetchDesignations();
      } else {
        snackbar.show(data.error?.message ?? "Failed to restore designation", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    }
  }

  const columns: Column<DesignationMasterRow>[] = [
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
              {can("designations", "update") && (
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
              {can("designations", "delete") && (
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
            <DialogTitle>Delete designation?</DialogTitle>
            <DialogDescription>
              This will permanently delete the designation &ldquo;{row.name}&rdquo;.
              If it is currently assigned to any staff members, deletion will be blocked to preserve historical record integrity.
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
        <BreadcrumbItem>Designations</BreadcrumbItem>
      </Breadcrumb>

      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">
          Designations Catalog
        </h1>
        <p className="text-body-sm text-on-surface-variant">
          Manage staff job titles, positions, and academic roles across the school
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search designations"
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <label className="text-body-sm text-on-surface-variant cursor-pointer" onClick={() => setShowInactive(!showInactive)}>
                Show Inactive
              </label>
            </div>
          </div>
          <PermissionGate module="designations" action="create">
            <Button
              variant="filled"
              icon="add"
              onClick={openCreate}
              className="hidden md:inline-flex"
            >
              Add Designation
            </Button>
          </PermissionGate>
        </div>

        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
            columns={columns}
            data={designations}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => {
              if (can("designations", "update")) {
                openEdit(row);
              }
            }}
            loading={loading}
            quickFilter={searchInput}
            getRowClass={(params) => (!params.data?.isActive ? "opacity-60 bg-surface-container-lowest" : "")}
            emptyIcon="work"
            emptyMessage="No designations found"
          />
        </div>
      </div>

      <PermissionGate module="designations" action="create">
        <FAB icon="add" onClick={openCreate} />
      </PermissionGate>

      <DesignationMasterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initialData={editingDesignation}
        onSuccess={fetchDesignations}
      />
    </div>
  );
}
