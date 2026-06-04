"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { useSnackbar } from "@/components/ui/snackbar";
import { useBranches } from "@/hooks/use-branches";
import { useRoles } from "@/hooks/use-roles";
import { useAllPermissions } from "@/hooks/use-all-permissions";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { createStaffSchema, updateStaffSchema } from "@/lib/validations/staff";
import { cn } from "@/lib/utils";

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
] as const;

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

interface StaffData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  userId?: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  qualification: string | null;
  joinDate: string;
  status: string;
  branch: { id: string; name: string };
  user?: {
    permissions: { permissionId: string; granted: boolean }[];
  } | null;
}

interface StaffFormProps {
  mode: "create" | "edit";
  initialData?: StaffData;
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function StaffForm({ mode, initialData }: StaffFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();
  const { branches, isLoading: branchesLoading } = useBranches();

  const isSuperAdmin = session?.user?.roleName === "SCHOOL_ADMIN" || session?.user?.roleName === "SUPER_ADMIN";

  const { roles, loading: rolesLoading } = useRoles();
  const { permissions: allPermissions, loading: permsLoading } = useAllPermissions();

  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [roleId, setRoleId] = useState("");
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (initialData?.user?.permissions) {
      initialData.user.permissions.forEach(p => {
        map[p.permissionId] = p.granted;
      });
    }
    return map;
  });
  
  // Set roleId once roles are loaded if in edit mode
  useEffect(() => {
    if (initialData?.role && roles.length > 0 && !roleId) {
      const found = roles.find((r) => r.name === initialData.role);
      if (found) setRoleId(found.id);
    }
  }, [initialData?.role, roles, roleId]);

  const [dateOfBirth, setDateOfBirth] = useState(formatDateForInput(initialData?.dateOfBirth));
  const [gender, setGender] = useState(initialData?.gender ?? "");
  const [qualification, setQualification] = useState(initialData?.qualification ?? "");
  const [joinDate, setJoinDate] = useState(formatDateForInput(initialData?.joinDate));
  const [branchId, setBranchId] = useState(initialData?.branch?.id ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "ACTIVE");

  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");

  // Auto-assign branch for non-SUPER_ADMIN users
  useEffect(() => {
    if (!isSuperAdmin && session?.user?.branchId && !branchId) {
      setBranchId(session.user.branchId);
    }
  }, [isSuperAdmin, session?.user?.branchId, branchId]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "custom">("all");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (mode === "create") {
      const result = createStaffSchema.safeParse({
        name,
        email: email || undefined,
        phone: phone || undefined,
        roleId,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        qualification: qualification || undefined,
        joinDate: joinDate || undefined,
        branchId,
        createAccount,
        password: password || undefined,
        customPermissions: Object.entries(customPermissions).map(([permissionId, granted]) => ({
          permissionId,
          granted
        }))
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/v1/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to create staff member", "error");
          return;
        }

        snackbar.show("Staff member created successfully", "success");
        router.push("/staff");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    } else {
      const result = updateStaffSchema.safeParse({
        name,
        email: email || undefined,
        phone: phone || undefined,
        roleId: roleId || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        qualification: qualification || undefined,
        joinDate: joinDate || undefined,
        branchId: branchId || undefined,
        status,
        createAccount,
        password: password || undefined,
        customPermissions: Object.entries(customPermissions).map(([permissionId, granted]) => ({
          permissionId,
          granted
        }))
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/v1/staff/${initialData!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const data = await res.json();

        if (!data.success) {
          snackbar.show(data.error?.message ?? "Failed to update staff member", "error");
          return;
        }

        snackbar.show("Staff member updated successfully", "success");
        router.push("/staff");
        router.refresh();
      } catch {
        snackbar.show("An error occurred", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  // Derive permissions state
  const selectedRole = roles.find(r => r.id === roleId);
  // Type assertion since rolePermissions is not exposed in the hook's interface but is returned by API
  const rolePermissionIds = new Set(
    (selectedRole as any)?.rolePermissions?.map((rp: any) => rp.permissionId) || []
  );

  // Group all permissions by module
  const permissionsByModule: Record<string, typeof allPermissions> = {};
  allPermissions.forEach(p => {
    if (!permissionsByModule[p.module]) {
      permissionsByModule[p.module] = [];
    }
    permissionsByModule[p.module].push(p);
  });

  // Filter modules based on search and filters
  const filteredModules = Object.entries(permissionsByModule).filter(([moduleName, perms]) => {
    // 1. Search term filter
    const matchesSearch = moduleName.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()) ||
      perms.some(p => p.action.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()));
      
    if (!matchesSearch) return false;
    
    // 2. Filter mode filter
    if (filterMode === 'custom') {
      const hasAnyOverride = perms.some(p => customPermissions[p.id] !== undefined);
      return hasAnyOverride;
    }
    
    return true;
  });

  const handleTogglePermission = (permissionId: string, roleHasIt: boolean) => {
    setCustomPermissions(prev => {
      const next = { ...prev };
      const currentlyGranted = prev[permissionId] !== undefined ? prev[permissionId] : roleHasIt;
      
      // If the new state is exactly what the role template has, we can delete the override
      if (!currentlyGranted === roleHasIt) {
        delete next[permissionId];
      } else {
        next[permissionId] = !currentlyGranted;
      }
      return next;
    });
  };

  const getPermissionByCol = (perms: typeof allPermissions, col: 'read' | 'create' | 'update' | 'delete' | 'special') => {
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

  const handleResetAllOverrides = () => {
    setCustomPermissions({});
    snackbar.show("All custom permission overrides have been reset to role defaults.");
  };

  const handleResetRowOverrides = (moduleName: string, perms: typeof allPermissions) => {
    setCustomPermissions(prev => {
      const next = { ...prev };
      perms.forEach(p => {
        delete next[p.id];
      });
      return next;
    });
    snackbar.show(`Reset custom overrides for ${moduleName.replace(/_/g, ' ')}`);
  };

  const handleToggleRow = (moduleName: string, perms: typeof allPermissions) => {
    const activeStates = perms.map(p => {
      const roleHasIt = rolePermissionIds.has(p.id);
      const hasOverride = customPermissions[p.id] !== undefined;
      return hasOverride ? customPermissions[p.id] : roleHasIt;
    });
    
    const targetState = !activeStates.every(Boolean);
    
    setCustomPermissions(prev => {
      const next = { ...prev };
      perms.forEach(p => {
        const roleHasIt = rolePermissionIds.has(p.id);
        if (targetState === roleHasIt) {
          delete next[p.id];
        } else {
          next[p.id] = targetState;
        }
      });
      return next;
    });
    snackbar.show(`${targetState ? 'Granted' : 'Revoked'} all permissions for ${moduleName.replace(/_/g, ' ')}`);
  };

  const handleToggleColumn = (col: 'read' | 'create' | 'update' | 'delete' | 'special') => {
    const applicablePerms = allPermissions.filter(p => {
      const act = p.action;
      if (col === 'read') return act === 'read' || act === 'view';
      if (col === 'create') return act === 'create';
      if (col === 'update') return act === 'update';
      if (col === 'delete') return act === 'delete';
      if (col === 'special') return act === 'manage' || act === 'approve' || act === 'grade' || act === 'export';
      return false;
    });
    
    if (applicablePerms.length === 0) return;
    
    const activeStates = applicablePerms.map(p => {
      const roleHasIt = rolePermissionIds.has(p.id);
      const hasOverride = customPermissions[p.id] !== undefined;
      return hasOverride ? customPermissions[p.id] : roleHasIt;
    });
    
    const targetState = !activeStates.every(Boolean);
    
    setCustomPermissions(prev => {
      const next = { ...prev };
      applicablePerms.forEach(p => {
        const roleHasIt = rolePermissionIds.has(p.id);
        if (targetState === roleHasIt) {
          delete next[p.id];
        } else {
          next[p.id] = targetState;
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

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl pb-12">
      {/* Sleek Header Section */}
      <div className="mb-8 border-b border-outline-variant/30 pb-6">
        <h2 className="text-display-sm font-bold text-on-surface tracking-tight">
          {mode === "create" ? "Add New Staff" : "Edit Staff Profile"}
        </h2>
        <p className="text-body-lg text-on-surface-variant mt-2 max-w-xl">
          Enter the professional and personal details. This information manages their system access and school records.
        </p>
      </div>
      
      <div className="space-y-8">
        {/* Section: Identity Information */}
        <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-surface">
          <div className="bg-surface-container-lowest/50 px-6 py-5 border-b border-outline-variant/30">
            <h3 className="text-title-md font-medium text-on-surface flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              Identity Information
            </h3>
          </div>
          <CardContent className="p-6 md:p-8 space-y-6">
            <TextField
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leadingIcon="person"
              error={errors.name}
              required
              fullWidth
              autoComplete="name"
            />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <TextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leadingIcon="mail"
                error={errors.email}
                fullWidth
                autoComplete="email"
                helperText="Required for system login"
              />
              <TextField
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leadingIcon="phone"
                error={errors.phone}
                fullWidth
                autoComplete="tel"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section: Professional Details */}
        <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-surface">
          <div className="bg-surface-container-lowest/50 px-6 py-5 border-b border-outline-variant/30">
            <h3 className="text-title-md font-medium text-on-surface flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">work</span>
              </div>
              Professional Details
            </h3>
          </div>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-on-surface-variant font-medium px-1">
                  Role <span className="text-error">*</span>
                </label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
                    <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role"} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roleId && (
                  <p className="px-3 mt-1 text-[12px] text-error">{errors.roleId}</p>
                )}
              </div>

              {isSuperAdmin && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md text-on-surface-variant font-medium px-1">
                    Branch <span className="text-error">*</span>
                  </label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
                      <SelectValue placeholder={branchesLoading ? "Loading..." : "Select a branch"} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.branchId && (
                    <p className="px-3 mt-1 text-[12px] text-error">{errors.branchId}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <TextField
                label="Join Date"
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                leadingIcon="event"
                error={errors.joinDate}
                fullWidth
              />
              {mode === "edit" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md text-on-surface-variant font-medium px-1">
                    Status
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section: System Access */}
        <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-surface">
          <div className="bg-surface-container-lowest/50 px-6 py-5 border-b border-outline-variant/30 flex items-center justify-between">
            <h3 className="text-title-md font-medium text-on-surface flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              System Access & Permissions
            </h3>
            {!initialData?.userId && (
              <div className="flex items-center gap-3">
                <span className="text-label-md text-on-surface-variant font-medium">Enable Login</span>
                <Switch checked={createAccount} onCheckedChange={setCreateAccount} />
              </div>
            )}
          </div>
          
          <CardContent className="p-6 md:p-8 space-y-8">
            {createAccount && !initialData?.userId && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-primary/10 text-on-surface-variant p-4 rounded-xl text-sm mb-2 flex gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
                  <span>Enabling system access will create a secure login account for this staff member using their email address.</span>
                </div>
                <TextField
                  label="Initial Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leadingIcon="key"
                  error={errors.password}
                  required={createAccount}
                  fullWidth
                  helperText="Password must be at least 6 characters"
                />
              </div>
            )}

            {/* Permissions Grid */}
            <div className={`space-y-4 ${!createAccount && !initialData?.userId ? 'opacity-60' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-title-sm font-semibold text-on-surface flex items-center gap-2.5">
                    Access Permissions
                    {Object.keys(customPermissions).length > 0 && (
                      <span className="text-[10px] tracking-wider uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/20">
                        {Object.keys(customPermissions).length} Custom Override{Object.keys(customPermissions).length > 1 ? 's' : ''}
                      </span>
                    )}
                  </h4>
                  {!createAccount && !initialData?.userId && (
                    <p className="text-label-sm text-on-surface-variant mt-1">Enable login access above to customize these permissions.</p>
                  )}
                </div>
                {permsLoading && <span className="text-label-sm text-on-surface-variant flex items-center gap-1.5"><span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> Loading...</span>}
              </div>
              
              {!roleId ? (
                <div className="text-body-md text-on-surface-variant py-8 px-4 bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant/50 text-center">
                  Please select a role above to view the permission template.
                </div>
              ) : allPermissions.length > 0 ? (
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
                        onClick={() => setFilterMode('custom')}
                        className={`px-3 py-1 rounded-lg text-label-sm font-medium transition-all ${filterMode === 'custom' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface hover:bg-surface-container-low border border-outline-variant/20 text-on-surface-variant'} flex items-center gap-1.5 h-9`}
                      >
                        <span>Overridden</span>
                        {Object.keys(customPermissions).length > 0 && (
                          <span className={`rounded-full px-1.5 py-0.25 text-[9px] font-bold ${filterMode === 'custom' ? 'bg-on-primary text-primary' : 'bg-amber-500 text-on-primary'}`}>
                            {Object.keys(customPermissions).length}
                          </span>
                        )}
                      </button>
                      {Object.keys(customPermissions).length > 0 && (
                        <button
                          type="button"
                          onClick={handleResetAllOverrides}
                          className="px-3 py-1 bg-error/10 hover:bg-error/20 text-error font-semibold text-label-sm rounded-lg transition-all flex items-center gap-1.5 h-9 border border-error/10"
                        >
                          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                          Reset Overrides
                        </button>
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
                              className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full"
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
                              className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full"
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
                              className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full"
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
                              className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full"
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
                              className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 px-2 rounded hover:bg-surface-container-high transition-colors font-semibold w-full"
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
                            
                            const hasAnyOverride = perms.some(p => customPermissions[p.id] !== undefined);
                            
                            const renderCheckboxCell = (p?: typeof allPermissions[number], isSpecial = false) => {
                              if (!p) {
                                return (
                                  <td className="p-2 text-center text-on-surface-variant/20 select-none text-xs font-mono">
                                    —
                                  </td>
                                );
                              }
                              
                              const roleHasIt = rolePermissionIds.has(p.id);
                              const hasOverride = customPermissions[p.id] !== undefined;
                              const isGranted = hasOverride ? customPermissions[p.id] : roleHasIt;
                              
                              return (
                                <td className="p-2 text-center">
                                  <div className="inline-flex flex-col items-center justify-center gap-1 select-none">
                                    <div className="relative inline-flex items-center justify-center">
                                      <Checkbox
                                        checked={isGranted}
                                        disabled={!createAccount && !initialData?.userId}
                                        onChange={() => {
                                          if (createAccount || initialData?.userId) {
                                            handleTogglePermission(p.id, roleHasIt);
                                          } else {
                                            setCreateAccount(true);
                                            handleTogglePermission(p.id, roleHasIt);
                                          }
                                        }}
                                        className={cn(
                                          "transition-all duration-200 rounded-[4px] border",
                                          hasOverride
                                            ? isGranted
                                              ? "border-amber-500 bg-amber-500 checked:bg-amber-500 checked:border-amber-500 text-on-primary ring-2 ring-amber-500/20"
                                              : "border-amber-500/70 border-dashed hover:border-amber-500 hover:bg-amber-500/5 checked:bg-transparent"
                                            : isGranted
                                            ? "border-primary bg-primary checked:bg-primary text-on-primary"
                                            : "border-outline hover:border-outline-variant hover:bg-surface-container-low"
                                        )}
                                        title={p.description || `${p.action} permission`}
                                      />
                                      {hasOverride && (
                                        <span 
                                          className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 border-2 border-surface rounded-full shadow-sm" 
                                          title="Custom Override Applied" 
                                        />
                                      )}
                                    </div>
                                    {isSpecial && (
                                      <span className={`text-[9px] font-bold uppercase tracking-wider scale-90 ${hasOverride ? 'text-amber-600 dark:text-amber-400' : 'text-on-surface-variant/70'} truncate max-w-full block`}>
                                        {p.action}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            };
                            
                            return (
                              <tr 
                                key={moduleName} 
                                className={cn(
                                  "hover:bg-primary/5 transition-colors group/row",
                                  hasAnyOverride && "bg-amber-500/[0.02]"
                                )}
                              >
                                <td className="p-3 pl-4 font-medium text-on-surface whitespace-nowrap overflow-hidden">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <span className={cn(
                                      "material-symbols-outlined text-[18px] shrink-0",
                                      hasAnyOverride ? "text-amber-500" : "text-primary/70 group-hover/row:text-primary transition-colors"
                                    )}>
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
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRow(moduleName, perms)}
                                      className="p-1 rounded-md text-on-surface-variant/60 hover:text-primary hover:bg-surface-container-high transition-colors"
                                      title={`Toggle all permissions for ${moduleName.replace(/_/g, ' ')}`}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">done_all</span>
                                    </button>
                                    
                                    {hasAnyOverride && (
                                      <button
                                        type="button"
                                        onClick={() => handleResetRowOverrides(moduleName, perms)}
                                        className="p-1 rounded-md text-amber-500 hover:text-error hover:bg-surface-container-high transition-colors"
                                        title={`Reset custom overrides for ${moduleName.replace(/_/g, ' ')}`}
                                      >
                                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Aesthetic Visual Legend */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-on-surface-variant/80 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/15">
                    <span className="font-semibold text-[10px] uppercase tracking-wider text-on-surface-variant/60">Legend:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-[4px] bg-primary border border-primary flex items-center justify-center text-[10px] text-on-primary">✓</div>
                      <span>Inherited Grant (Role template)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-[4px] border border-outline bg-surface" />
                      <span>Inherited Deny (Role template)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-[4px] bg-amber-500 border border-amber-500 flex items-center justify-center text-[10px] text-on-primary relative">
                        ✓
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full border border-surface" />
                      </div>
                      <span className="text-amber-700 dark:text-amber-400 font-medium">Custom Grant (Override)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-[4px] border border-dashed border-amber-500 bg-surface relative">
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full border border-surface" />
                      </div>
                      <span className="text-amber-700 dark:text-amber-400 font-medium">Custom Revoke (Override)</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Section: Personal Details */}
        <Card variant="outlined" className="overflow-hidden border-outline-variant/40 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl bg-surface">
          <div className="bg-surface-container-lowest/50 px-6 py-5 border-b border-outline-variant/30">
            <h3 className="text-title-md font-medium text-on-surface flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">account_circle</span>
              </div>
              Personal Details
            </h3>
          </div>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <TextField
                label="Date of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                leadingIcon="cake"
                error={errors.dateOfBirth}
                fullWidth
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-label-md text-on-surface-variant font-medium px-1">
                  Gender
                </label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger fullWidth className="h-[56px] rounded-[8px]">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.gender && (
                  <p className="px-3 mt-1 text-[12px] text-error">{errors.gender}</p>
                )}
              </div>
            </div>
            <TextField
              label="Qualification / Degrees"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              leadingIcon="school"
              error={errors.qualification}
              fullWidth
              placeholder="e.g. M.Sc, B.Ed"
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-outline-variant/20">
          <Button
            type="button"
            variant="text"
            onClick={() => router.push("/staff")}
            className="text-on-surface-variant hover:text-on-surface"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="filled" 
            loading={loading} 
            icon="save"
            className="px-8 shadow-sm rounded-full"
          >
            {mode === "create" ? "Create Staff Profile" : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
