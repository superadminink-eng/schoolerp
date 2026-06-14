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
import { SelectField } from "@/components/ui/select-field";

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
  admissions: "assignment_ind",
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
  type: "STAFF" | "STUDENT" | "PARENT";
  isSystem: boolean;
  permissions: string[];
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
  const [type, setType] = useState<"STAFF" | "STUDENT" | "PARENT">(initialData?.type ?? "STAFF");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(initialData?.permissions ?? [])
  );
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Accordion State
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

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
          // Auto-expand first 2 modules by default
          const uniqueModules = Array.from(new Set((data.data as Permission[]).map(p => p.module)));
          setExpandedModules(new Set(uniqueModules.slice(0, 2)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    fetchPermissions();
  }, []);

  const permissionsByModule: Record<string, Permission[]> = {};
  permissions.forEach(p => {
    if (!permissionsByModule[p.module]) permissionsByModule[p.module] = [];
    permissionsByModule[p.module].push(p);
  });

  const togglePermission = (id: string) => {
    if (disableEdits) return;
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectModule = (modulePerms: Permission[], selectAll: boolean) => {
    if (disableEdits) return;
    setSelectedPerms(prev => {
      const next = new Set(prev);
      modulePerms.forEach(p => {
        if (selectAll) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  const toggleAccordion = (moduleName: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleName)) next.delete(moduleName);
      else next.add(moduleName);
      return next;
    });
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
          type: type,
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
      router.push("/roles");
      router.refresh();
    } catch (err) {
      snackbar.show("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-8 animate-in slide-in-from-bottom-4 duration-500 fade-in">
      {/* Title & Description Area */}
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-on-surface tracking-tight">
          {mode === "create" ? "Create New Role" : "Edit Role Settings"}
        </h2>
        <p className="text-sm text-on-surface-variant">
          Configure role properties and define module access levels.
        </p>
      </div>

      {/* Basic Details Bento Card */}
      <Card variant="outlined" className="bg-surface-container-lowest shadow-sm shadow-slate-200/50 rounded-2xl border-outline-variant/40 group hover:border-primary/20 transition-all duration-300">
        <div className="bg-surface-dim/30 px-6 py-4 border-b border-outline-variant/20">
          <h3 className="text-sm font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            Role Profile
          </h3>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <TextField
              label="Role Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
              fullWidth
              disabled={isSystem}
            />
            <SelectField
              label="Role Category"
              value={type}
              onValueChange={(val) => setType(val as any)}
              options={[
                { value: "STAFF", label: "Staff" },
                { value: "STUDENT", label: "Student" },
                { value: "PARENT", label: "Parent" }
              ]}
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

      {/* Permissions Bento Card */}
      <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm shadow-slate-200/50 rounded-2xl bg-surface-container-lowest group hover:border-primary/20 transition-all duration-300">
        <div className="bg-gradient-to-r from-slate-50 to-primary-container/10 px-6 py-5 border-b border-outline-variant/20 flex items-center justify-between">
          <div>
            <h2 className="text-title-md font-extrabold text-on-surface flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              </span>
              Module Permissions Matrix
            </h2>
            <p className="text-xs text-on-surface-variant font-medium mt-1.5">
              Precisely control what users with this role can view or manage.
            </p>
          </div>
          {isSystem && (
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              {disableEdits ? "System Role (Locked)" : "System Role (Editable)"}
            </span>
          )}
        </div>
        
        <CardContent className="p-0">
          {fetching ? (
            <div className="flex items-center justify-center p-16 text-slate-400 gap-3">
                <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                <span className="text-sm font-bold tracking-wider uppercase">Loading Structure...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-outline-variant/10">
              {Object.entries(permissionsByModule).map(([moduleName, perms]) => {
                const isExpanded = expandedModules.has(moduleName);
                const allModuleSelected = perms.every(p => selectedPerms.has(p.id));
                const someModuleSelected = perms.some(p => selectedPerms.has(p.id));
                const indeterminate = someModuleSelected && !allModuleSelected;

                return (
                  <div key={moduleName} className="flex flex-col group/accordion">
                    {/* Accordion Header */}
                    <div 
                      className={cn(
                        "flex items-center justify-between px-6 py-4 cursor-pointer transition-all duration-300 hover:bg-slate-50",
                        isExpanded ? "bg-slate-50" : ""
                      )}
                      onClick={() => toggleAccordion(moduleName)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
                          someModuleSelected ? "bg-primary text-on-primary shadow-md shadow-primary/10" : "bg-slate-100 text-slate-400 group-hover/accordion:bg-slate-200"
                        )}>
                          <span className="material-symbols-outlined text-[20px]">
                            {MODULE_ICONS[moduleName] || "extension"}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold capitalize text-on-surface">
                            {moduleName.replace(/_/g, " ")}
                          </h3>
                          <p className="text-[11px] font-medium text-on-surface-variant/70 mt-0.5 uppercase tracking-wider">
                            <span className={cn(someModuleSelected ? "text-primary font-bold" : "")}>
                              {perms.filter(p => selectedPerms.has(p.id)).length}
                            </span> 
                            {" "}of {perms.length} active
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                        {!disableEdits && (
                          <label className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-200/50 px-3 py-1.5 rounded-lg transition-colors">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Select All</span>
                            <Checkbox
                              checked={allModuleSelected}
                              // @ts-ignore
                              onChange={(e) => handleSelectModule(perms, e.target.checked)}
                              disabled={disableEdits}
                              className={cn(
                                "rounded-md border-slate-300 w-5 h-5",
                                indeterminate && !allModuleSelected ? "bg-primary/80 border-primary/80" : ""
                              )}
                            />
                          </label>
                        )}
                        <button 
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-400"
                          onClick={() => toggleAccordion(moduleName)}
                        >
                          <span className={cn(
                            "material-symbols-outlined transition-transform duration-300",
                            isExpanded ? "rotate-180 text-primary" : ""
                          )}>
                            expand_more
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Accordion Content */}
                    <div className={cn(
                      "grid gap-4 overflow-hidden transition-all duration-300 ease-in-out bg-slate-50/50 border-t border-slate-100",
                      isExpanded ? "py-6 opacity-100 max-h-[800px]" : "max-h-0 opacity-0 py-0 border-transparent"
                    )}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-6 pl-14">
                        {perms.map(p => (
                          <label 
                            key={p.id} 
                            className={cn(
                              "relative flex items-start gap-3 p-4 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden group/perm",
                              selectedPerms.has(p.id) 
                                ? "bg-white border-primary/20 shadow-sm shadow-primary/5 bg-primary-container/5" 
                                : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                            )}
                          >
                            {selectedPerms.has(p.id) && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                            )}
                            <div className="mt-0.5 shrink-0">
                              <Checkbox
                                checked={selectedPerms.has(p.id)}
                                onChange={() => togglePermission(p.id)}
                                disabled={disableEdits}
                                className={cn(
                                  "w-5 h-5 rounded-md",
                                  selectedPerms.has(p.id) ? "border-primary" : "border-slate-300"
                                )}
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className={cn(
                                "text-[11px] font-black uppercase tracking-wider transition-colors",
                                selectedPerms.has(p.id) ? "text-primary font-bold" : "text-slate-600 group-hover/perm:text-slate-900"
                              )}>
                                {p.action.replace(/_/g, " ")}
                              </span>
                              {p.description && (
                                <span className="text-[11px] text-slate-500 leading-snug mt-1 font-medium">
                                  {p.description}
                                </span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-6 pb-12">
        <Button
          type="button"
          variant="outlined"
          onClick={() => router.push("/roles")}
          className="rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100 font-bold px-6"
        >
          {disableEdits ? "Go Back" : "Cancel"}
        </Button>
        {!disableEdits && (
          <Button 
            type="submit" 
            variant="filled" 
            loading={loading} 
            className="rounded-xl font-bold px-8 transition-all hover:scale-[1.02]"
          >
            {mode === "create" ? "Create Role Profile" : "Save Settings"}
          </Button>
        )}
      </div>
    </form>
  );
}
