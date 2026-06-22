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
import { SubjectMasterDialog } from "@/components/subject-masters/subject-master-dialog";

interface SubjectMasterRow {
  id: string;
  name: string;
  code: string;
  type: string;
  description?: string | null;
  isActive: boolean;
}

export default function SubjectMastersPage() {
  const snackbar = useSnackbar();
  const { can } = usePermissions();

  const [subjects, setSubjects] = useState<SubjectMasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingSubject, setEditingSubject] = useState<SubjectMasterRow | null>(
    null
  );

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const url = showInactive 
        ? "/api/v1/subject-masters?active=false" 
        : "/api/v1/subject-masters";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setSubjects(data.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  function openCreate() {
    setDialogMode("create");
    setEditingSubject(null);
    setDialogOpen(true);
  }

  function openEdit(subject: SubjectMasterRow) {
    setDialogMode("edit");
    setEditingSubject(subject);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/subject-masters/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Subject deleted permanently", "success");
        fetchSubjects();
      } else {
        // Specifically show the HAS_DEPENDENCIES error or fallback
        snackbar.show(data.error?.message ?? "Failed to delete subject", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    } finally {
      setDeleting(false);
      setDialogOpen(false);
    }
  }

  async function handleRestore(id: string) {
    try {
      const res = await fetch(`/api/v1/subject-masters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Subject restored successfully", "success");
        fetchSubjects();
      } else {
        snackbar.show(data.error?.message ?? "Failed to restore subject", "error");
      }
    } catch {
      snackbar.show("An error occurred", "error");
    }
  }

  const typeLabel: Record<string, string> = {
    THEORY: "Theory",
    PRACTICAL: "Practical",
    ELECTIVE: "Elective",
  };

  const columns: Column<SubjectMasterRow>[] = [
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
      key: "type",
      header: "Type",
      render: (row) => typeLabel[row.type] ?? row.type,
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
                  openEdit(row);
                }}
              >
                Edit
              </MenuItem>
              {can("subjects", "delete") && (
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
            <DialogTitle>Delete subject?</DialogTitle>
            <DialogDescription>
              This will permanently delete the subject &ldquo;{row.name}&rdquo;.
              If it is referenced by any classes, deletion will be blocked to preserve historical data.
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
        <BreadcrumbItem>Subjects</BreadcrumbItem>
      </Breadcrumb>

      <h1 className="text-headline-md font-semibold text-on-surface mb-6">
        Subject Catalog
      </h1>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search subjects"
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-2">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              <label className="text-body-sm text-on-surface-variant cursor-pointer" onClick={() => setShowInactive(!showInactive)}>
                Show Inactive
              </label>
            </div>
          </div>
          <PermissionGate module="subjects" action="create">
            <Button
              variant="filled"
              icon="add"
              onClick={openCreate}
              className="hidden md:inline-flex"
            >
              Add Subject
            </Button>
          </PermissionGate>
        </div>

        <div className="rounded-md border border-outline-variant bg-surface overflow-hidden">
          <DataTable
          columns={columns}
          data={subjects}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => openEdit(row)}
          loading={loading}
          quickFilter={searchInput}
          getRowClass={(params) => (!params.data?.isActive ? "opacity-60 bg-surface-container-lowest" : "")}
          emptyIcon="book"
          emptyMessage="No subjects found"
          />
        </div>
      </div>

      <PermissionGate module="subjects" action="create">
        <FAB icon="add" onClick={openCreate} />
      </PermissionGate>

      <SubjectMasterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initialData={editingSubject}
        onSuccess={fetchSubjects}
      />
    </div>
  );
}
