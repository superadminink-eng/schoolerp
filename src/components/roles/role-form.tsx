"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { useSnackbar } from "@/components/ui/snackbar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const MODULE_ICONS: Record<string, string> = {
  students: "school",
  staff: "badge",
  attendance: "fact_check",
  fees: "payments",
  exams: "quiz",
  timetable: "calendar_month",
  transport: "directions_bus",
  library: "local_library",
  hostel: "apartment",
  notices: "campaign",
  events: "event",
  reports: "analytics",
  settings: "settings",
  subjects: "menu_book",
  classes: "class",
  academic_years: "date_range",
  branches: "location_city",
  users: "group",
};

interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[]; // array of permission IDs
}

interface RoleFormProps {
  mode: "create" | "edit";
  initialData?: RoleData;
}

export function RoleForm({ mode, initialData }: RoleFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(initialData?.permissions ?? [])
  );
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "selected">("all");

  const isSystem = initialData?.isSystem ?? false;
  const isUserAdmin = session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN";
  const disableEdits = isSystem && !isUserAdmin;

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const res = await fetch("/api/v1/permissions");
        const data = await res.json();
        if (data.success) {
          setPermissions(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    fetchPermissions();
  }, []);

  // Group all permissions by module
  const permissionsByModule: Record<string, Permission[]> = {};
  permissions.forEach(p => {
    if (!permissionsByModule[p.module]) {
      permissionsByModule[p.module] = [];
    }
    permissionsByModule[p.module].push(p);
  });

  // Filter modules based on search and filters
  const filteredModules = Object.entries(permissionsByModule).filter(([moduleName, perms]) => {
    // 1. Search filter
    const matchesSearch = moduleName.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()) ||
      perms.some(p => p.action.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()));
      
    if (!matchesSearch) return false;
    
    // 2. Filter mode filter
    if (filterMode === 'selected') {
      const hasAnySelected = perms.some(p => selectedPerms.has(p.id));
      return hasAnySelected;
    }
    
    return true;
  });

  const togglePermission = (id: string) => {
    if (disableEdits) return; // cannot edit system roles unless admin
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getPermissionByCol = (perms: Permission[], col: 'read' | 'create' | 'update' | 'delete' | 'special') => {
    return perms.find(p => {
      const act = p.action;
      if (col === 'read') return act === 'read' || act === 'view';
      if (col === 'create') return act === 'create';
      if (col === 'update') return act === 'update';
      if (col === 'delete') return act === 'delete';
      if (col === 'special') return act === 'manage' || act === 'approve' || act === 'grade' || act === 'export';
      return false;
    });
  };

  const handleToggleRow = (perms: Permission[]) => {
    if (disableEdits) return;
    const activeStates = perms.map(p => selectedPerms.has(p.id));
    const targetState = !activeStates.every(Boolean);
    
    setSelectedPerms(prev => {
      const next = new Set(prev);
      perms.forEach(p => {
        if (targetState) {
          next.add(p.id);
        } else {
          next.delete(p.id);
        }
      });
      return next;
    });
  };

  const handleToggleColumn = (col: 'read' | 'create' | 'update' | 'delete' | 'special') => {
    if (disableEdits) return;
    const applicablePerms = permissions.filter(p => {
      const act = p.action;
      if (col === 'read') return act === 'read' || act === 'view';
      if (col === 'create') return act === 'create';
      if (col === 'update') return act === 'update';
      if (col === 'delete') return act === 'delete';
      if (col === 'special') return act === 'manage' || act === 'approve' || act === 'grade' || act === 'export';
      return false;
    });
    
    if (applicablePerms.length === 0) return;
    
    const activeStates = applicablePerms.map(p => selectedPerms.has(p.id));
    const targetState = !activeStates.every(Boolean);
    
    setSelectedPerms(prev => {
      const next = new Set(prev);
      applicablePerms.forEach(p => {
        if (targetState) {
          next.add(p.id);
        } else {
          next.delete(p.id);
        }
      });
      return next;
    });
    
    const colLabel = {
      read: 'View',
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      special: 'Special / Manage'
    }[col];
    snackbar.show(`${targetState ? 'Granted' : 'Revoked'} all '${colLabel}' permissions`);
  };

  const handleSelectAll = () => {
    if (disableEdits) return;
    setSelectedPerms(new Set(permissions.map(p => p.id)));
    snackbar.show("Granted all permissions to this role.");
  };

  const handleClearAll = () => {
    if (disableEdits) return;
    setSelectedPerms(new Set());
    snackbar.show("Cleared all permissions for this role.");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disableEdits) return;

    setErrors({});
    if (name.trim().length < 2) {
      setErrors({ name: "Name must be at least 2 characters" });
      return;
    }
    if (selectedPerms.size === 0) {
      snackbar.show("Please select at least one permission");
      return;
    }

    setLoading(true);
    const payload = isSystem
      ? { permissions: Array.from(selectedPerms) }
      : {
          name: name.trim(),
          description: description.trim(),
          permissions: Array.from(selectedPerms),
        };

    try {
      const url = mode === "create" ? "/api/v1/roles" : `/api/v1/roles/${initialData!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        snackbar.show(data.error?.message ?? "Failed to save role");
        return;
      }

      snackbar.show(mode === "create" ? "Role created" : "Role updated");
      router.push("/settings/roles");
      router.refresh();
    } catch (err) {
      snackbar.show("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <Card variant="outlined">
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Role Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
              fullWidth
              disabled={isSystem}
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              disabled={isSystem}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-surface">
        <div className="bg-surface-container-lowest/50 px-6 py-5 border-b border-outline-variant/30 flex items-center justify-between">
          <h2 className="text-title-md font-semibold text-on-surface flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </div>
            Access Permissions
          </h2>
          {isSystem && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/30">
              {disableEdits ? "System Role (Read-only)" : "System Role (Customizable)"}
            </span>
          )}
        </div>
        
        <CardContent className="p-6 md:p-8 space-y-4">
          {fetching ? (
            <div className="text-body-md text-on-surface-variant flex items-center gap-2 py-4">
              <span className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              Loading permissions...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface-container-low/30 p-3.5 rounded-xl border border-outline-variant/20">
                <div className="relative w-full sm:max-w-[240px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Search modules..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant/50 rounded-lg text-body-medium focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50 text-sm h-9"
                    disabled={fetching}
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg text-label-sm font-medium transition-all ${filterMode === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface hover:bg-surface-container-low border border-outline-variant/20 text-on-surface-variant'} h-9`}
                  >
                    All Modules
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('selected')}
                    className={`px-3 py-1 rounded-lg text-label-sm font-medium transition-all ${filterMode === 'selected' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface hover:bg-surface-container-low border border-outline-variant/20 text-on-surface-variant'} flex items-center gap-1.5 h-9`}
                  >
                    <span>Selected Only</span>
                    {selectedPerms.size > 0 && (
                      <span className={`rounded-full px-1.5 py-0.25 text-[9px] font-bold ${filterMode === 'selected' ? 'bg-on-primary text-primary' : 'bg-primary text-on-primary'}`}>
                        {selectedPerms.size}
                      </span>
                    )}
                  </button>
                  {!disableEdits && (
                    <>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-label-sm rounded-lg transition-all h-9 border border-primary/10"
                      >
                        Grant All
                      </button>
                      {selectedPerms.size > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="px-3 py-1 bg-error/10 hover:bg-error/20 text-error font-semibold text-label-sm rounded-lg transition-all h-9 border border-error/10"
                        >
                          Clear All
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Dense Table Matrix */}
              <div className="overflow-x-hidden overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface shadow-sm max-h-[500px] scrollbar-thin">
                <table className="w-full border-collapse text-left table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-outline-variant/20 bg-surface-container-low text-label-sm font-semibold text-on-surface-variant select-none">
                      <th className="p-3 pl-4 font-semibold uppercase tracking-wider text-[11px] bg-surface-container-low w-[28%] md:w-[25%] truncate">Module</th>
                      
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center bg-surface-container-low w-[12%] md:w-[13%]">
                        <button
                          type="button"
                          onClick={() => handleToggleColumn('read')}
                          disabled={disableEdits}
                          className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full disabled:cursor-not-allowed disabled:hover:text-inherit"
                          title="Toggle View permission for all modules"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary/70">visibility</span>
                          <span className="hidden sm:inline">View</span>
                        </button>
                      </th>
                      
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center bg-surface-container-low w-[12%] md:w-[13%]">
                        <button
                          type="button"
                          onClick={() => handleToggleColumn('create')}
                          disabled={disableEdits}
                          className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full disabled:cursor-not-allowed disabled:hover:text-inherit"
                          title="Toggle Create permission for all modules"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary/70">add_circle</span>
                          <span className="hidden sm:inline">Create</span>
                        </button>
                      </th>
                      
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center bg-surface-container-low w-[12%] md:w-[13%]">
                        <button
                          type="button"
                          onClick={() => handleToggleColumn('update')}
                          disabled={disableEdits}
                          className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full disabled:cursor-not-allowed disabled:hover:text-inherit"
                          title="Toggle Edit permission for all modules"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary/70">edit</span>
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      </th>
                      
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center bg-surface-container-low w-[12%] md:w-[13%]">
                        <button
                          type="button"
                          onClick={() => handleToggleColumn('delete')}
                          disabled={disableEdits}
                          className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full disabled:cursor-not-allowed disabled:hover:text-inherit"
                          title="Toggle Delete permission for all modules"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary/70">delete</span>
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </th>
                      
                      <th className="p-3 font-semibold uppercase tracking-wider text-[11px] text-center bg-surface-container-low w-[16%] md:w-[15%]">
                        <button
                          type="button"
                          onClick={() => handleToggleColumn('special')}
                          disabled={disableEdits}
                          className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full disabled:cursor-not-allowed disabled:hover:text-inherit"
                          title="Toggle Special Actions for all modules"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary/70">stars</span>
                          <span className="hidden sm:inline">Special</span>
                        </button>
                      </th>
                      
                      <th className="p-3 pr-4 font-semibold uppercase tracking-wider text-[11px] text-center bg-surface-container-low w-[8%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15 text-sm">
                    {filteredModules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-on-surface-variant/60">
                          No matching modules found.
                        </td>
                      </tr>
                    ) : (
                      filteredModules.map(([moduleName, perms]) => {
                        const pRead = getPermissionByCol(perms, 'read');
                        const pCreate = getPermissionByCol(perms, 'create');
                        const pUpdate = getPermissionByCol(perms, 'update');
                        const pDelete = getPermissionByCol(perms, 'delete');
                        const pSpecial = getPermissionByCol(perms, 'special');
                        
                        const renderCheckboxCell = (p?: Permission, isSpecial = false) => {
                          if (!p) {
                            return (
                              <td className="p-2 text-center text-on-surface-variant/20 select-none text-xs font-mono">
                                —
                              </td>
                            );
                          }
                          
                          const isGranted = selectedPerms.has(p.id);
                          
                          return (
                            <td className="p-2 text-center">
                              <div className="inline-flex flex-col items-center justify-center gap-1 select-none">
                                <Checkbox
                                  checked={isGranted}
                                  disabled={disableEdits}
                                  onChange={() => togglePermission(p.id)}
                                  className="transition-all duration-200 rounded-[4px] border border-outline hover:border-outline-variant hover:bg-surface-container-low checked:border-primary checked:bg-primary"
                                  title={p.description || `${p.action} permission`}
                                />
                                {isSpecial && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70 scale-90 truncate max-w-full block">
                                    {p.action}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        };
                        
                        return (
                          <tr key={moduleName} className="hover:bg-primary/5 transition-colors group/row">
                            <td className="p-3 pl-4 font-medium text-on-surface whitespace-nowrap overflow-hidden">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <span className="material-symbols-outlined text-[18px] text-primary/70 group-hover/row:text-primary transition-colors shrink-0">
                                  {MODULE_ICONS[moduleName] || "extension"}
                                </span>
                                <span className="capitalize text-xs md:text-sm font-medium tracking-tight truncate" title={moduleName.replace(/_/g, " ")}>
                                  {moduleName.replace(/_/g, " ")}
                                </span>
                              </div>
                            </td>
                            
                            {renderCheckboxCell(pRead)}
                            {renderCheckboxCell(pCreate)}
                            {renderCheckboxCell(pUpdate)}
                            {renderCheckboxCell(pDelete)}
                            {renderCheckboxCell(pSpecial, true)}
                            
                            <td className="p-2 text-center whitespace-nowrap">
                              {!disableEdits && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRow(perms)}
                                  className="p-1 rounded-md text-on-surface-variant/60 hover:text-primary hover:bg-surface-container-high transition-colors"
                                  title={`Toggle all permissions for ${moduleName.replace(/_/g, ' ')}`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                                </button>
                              )}
                              {disableEdits && (
                                <span className="text-on-surface-variant/30 text-xs font-mono">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-6 border-t border-outline-variant/20">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/settings/roles")}
        >
          {disableEdits ? "Back" : "Cancel"}
        </Button>
        {!disableEdits && (
          <Button type="submit" variant="filled" loading={loading} icon="save" className="rounded-full px-6 shadow-sm">
            {mode === "create" ? "Create Role" : "Save Changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
