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
  admissions: "assignment_ind",
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

function getInitials(fullName: string) {
  if (!fullName) return "ST";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function StaffForm({ mode, initialData }: StaffFormProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const { data: session } = useSession();
  const { branches, isLoading: branchesLoading } = useBranches();

  const isSuperAdmin = session?.user?.roleName === "SCHOOL_ADMIN" || session?.user?.roleName === "SUPER_ADMIN";

  const { roles, loading: rolesLoading } = useRoles();
  const { permissions: allPermissions, loading: permsLoading } = useAllPermissions();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
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

  const validateStep1 = () => {
    const stepErrors: Record<string, string> = {};
    if (!name || name.trim().length < 2) {
      stepErrors.name = "Name must be at least 2 characters";
    } else if (name.trim().length > 100) {
      stepErrors.name = "Name must be at most 100 characters";
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        stepErrors.email = "Invalid email address";
      }
    }
    if (phone && phone.length > 20) {
      stepErrors.phone = "Phone must be at most 20 characters";
    }
    if (qualification && qualification.length > 200) {
      stepErrors.qualification = "Qualification must be at most 200 characters";
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep2 = () => {
    const stepErrors: Record<string, string> = {};
    if (!roleId) {
      stepErrors.roleId = "Role is required";
    }
    if (isSuperAdmin && !branchId) {
      stepErrors.branchId = "Branch is required";
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const validateStep3 = () => {
    const stepErrors: Record<string, string> = {};
    if (createAccount && !email) {
      stepErrors.email = "Email is required when creating an account";
    }
    if (createAccount && (!password || password.length < 6)) {
      stepErrors.password = "Password must be at least 6 characters";
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleContinue = () => {
    if (activeStep === 1) {
      if (validateStep1()) {
        setActiveStep(2);
      }
    } else if (activeStep === 2) {
      if (validateStep2()) {
        setActiveStep(3);
      }
    }
  };

  const handleStepClick = (targetStep: 1 | 2 | 3) => {
    if (targetStep === activeStep) return;
    if (targetStep < activeStep) {
      setActiveStep(targetStep);
      return;
    }
    if (activeStep === 1) {
      if (!validateStep1()) return;
      if (targetStep === 3) {
        if (!validateStep2()) return;
      }
    } else if (activeStep === 2) {
      if (!validateStep2()) return;
    }
    setActiveStep(targetStep);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side sequential checks
    if (!validateStep1()) {
      setActiveStep(1);
      return;
    }
    if (!validateStep2()) {
      setActiveStep(2);
      return;
    }
    if (!validateStep3()) {
      setActiveStep(3);
      if (createAccount && !email) {
        setActiveStep(1); // Snap back to step 1 for email
      }
      return;
    }

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
        let firstErrorStep: 1 | 2 | 3 | null = null;
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;

          if (!firstErrorStep) {
            if (["name", "email", "phone", "dateOfBirth", "gender", "qualification"].includes(key)) {
              firstErrorStep = 1;
            } else if (["roleId", "branchId", "joinDate", "status"].includes(key)) {
              firstErrorStep = 2;
            } else if (["createAccount", "password"].includes(key)) {
              firstErrorStep = 3;
            }
          }
        }
        setErrors(fieldErrors);
        if (firstErrorStep) {
          setActiveStep(firstErrorStep);
        }
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
        let firstErrorStep: 1 | 2 | 3 | null = null;
        for (const err of result.error.errors) {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = err.message;

          if (!firstErrorStep) {
            if (["name", "email", "phone", "dateOfBirth", "gender", "qualification"].includes(key)) {
              firstErrorStep = 1;
            } else if (["roleId", "branchId", "joinDate", "status"].includes(key)) {
              firstErrorStep = 2;
            } else if (["createAccount", "password"].includes(key)) {
              firstErrorStep = 3;
            }
          }
        }
        setErrors(fieldErrors);
        if (firstErrorStep) {
          setActiveStep(firstErrorStep);
        }
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
  const selectedRoleName = selectedRole?.name || "No Role Selected";
  const selectedBranchName = branches.find(b => b.id === branchId)?.name || "No Branch Selected";

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
    const matchesSearch = moduleName.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()) ||
      perms.some(p => p.action.replace(/_/g, ' ').toLowerCase().includes(searchTerm.toLowerCase()));
      
    if (!matchesSearch) return false;
    
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
    <div className="mx-auto max-w-7xl pb-12">
      {/* Sleek Silicon Valley layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column - Stepper & Live Preview Card (Sticky on desktop) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          
          {/* Stepper Card */}
          <Card className="border border-slate-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md shadow-sm rounded-2xl p-6">
            <div className="space-y-6">
              
              {/* Step 1 button */}
              <button
                type="button"
                onClick={() => handleStepClick(1)}
                className="flex items-start gap-4 text-left w-full group focus:outline-none"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-sm border text-sm",
                    activeStep === 1
                      ? "bg-primary text-on-primary border-primary ring-4 ring-primary/10 shadow-md shadow-primary/20"
                      : name && !errors.name
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                      : "bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800"
                  )}>
                    {name && !errors.name && activeStep !== 1 ? (
                      <span className="material-symbols-outlined text-[18px] font-bold">check</span>
                    ) : (
                      "1"
                    )}
                  </div>
                  <div className={cn(
                    "w-0.5 h-12 my-1.5 transition-colors duration-300",
                    activeStep > 1 ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800"
                  )} />
                </div>
                <div className="pt-1">
                  <h4 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    activeStep === 1 ? "text-primary" : "text-slate-700 dark:text-zinc-200"
                  )}>
                    Basic Profile
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Personal & contact details
                  </p>
                </div>
              </button>

              {/* Step 2 button */}
              <button
                type="button"
                onClick={() => handleStepClick(2)}
                className="flex items-start gap-4 text-left w-full group focus:outline-none"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-sm border text-sm",
                    activeStep === 2
                      ? "bg-primary text-on-primary border-primary ring-4 ring-primary/10 shadow-md shadow-primary/20"
                      : roleId && !errors.roleId
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30"
                      : "bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800"
                  )}>
                    {roleId && !errors.roleId && activeStep !== 2 ? (
                      <span className="material-symbols-outlined text-[18px] font-bold">check</span>
                    ) : (
                      "2"
                    )}
                  </div>
                  <div className={cn(
                    "w-0.5 h-12 my-1.5 transition-colors duration-300",
                    activeStep > 2 ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800"
                  )} />
                </div>
                <div className="pt-1">
                  <h4 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    activeStep === 2 ? "text-primary" : "text-slate-700 dark:text-zinc-200"
                  )}>
                    Professional Details
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Placement & role context
                  </p>
                </div>
              </button>

              {/* Step 3 button */}
              <button
                type="button"
                onClick={() => handleStepClick(3)}
                className="flex items-start gap-4 text-left w-full group focus:outline-none"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-sm border text-sm",
                    activeStep === 3
                      ? "bg-primary text-on-primary border-primary ring-4 ring-primary/10 shadow-md shadow-primary/20"
                      : "bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800"
                  )}>
                    "3"
                  </div>
                </div>
                <div className="pt-1">
                  <h4 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    activeStep === 3 ? "text-primary" : "text-slate-700 dark:text-zinc-200"
                  )}>
                    Security & Access
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Login & permission overrides
                  </p>
                </div>
              </button>
              
            </div>
          </Card>

          {/* Luxury Live Profile Preview Card */}
          <Card className="overflow-hidden border border-slate-200/50 dark:border-zinc-800/50 bg-gradient-to-br from-white/80 to-slate-50/50 dark:from-zinc-950/80 dark:to-zinc-900/50 backdrop-blur-md shadow-md rounded-2xl transition-all duration-300 hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                
                {/* Dynamic Initials Avatar */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-full blur opacity-30 group-hover:opacity-40 transition duration-500" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-md border-4 border-white dark:border-zinc-900">
                    {getInitials(name)}
                  </div>
                </div>

                {/* Name & Role */}
                <div className="space-y-1.5">
                  <h3 className={cn(
                    "text-lg font-bold tracking-tight text-slate-800 dark:text-zinc-100 transition-all duration-300 truncate max-w-[240px]",
                    !name && "text-slate-400 dark:text-zinc-500 italic font-normal"
                  )}>
                    {name || "New Staff Member"}
                  </h3>
                  
                  {/* Role Chip */}
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                    <span className="material-symbols-outlined text-[12px]">badge</span>
                    {selectedRoleName}
                  </div>
                </div>

                <Divider className="w-full opacity-50" />

                {/* Details list */}
                <div className="w-full space-y-2.5 text-left text-xs font-medium text-slate-600 dark:text-zinc-300">
                  
                  {/* Email */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100/60 dark:bg-zinc-900 flex items-center justify-center text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-[16px]">mail</span>
                    </div>
                    <span className={cn("truncate flex-1", !email && "text-slate-400 dark:text-zinc-500 italic font-normal")}>
                      {email || "No email address"}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100/60 dark:bg-zinc-900 flex items-center justify-center text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-[16px]">phone</span>
                    </div>
                    <span className={cn("truncate flex-1", !phone && "text-slate-400 dark:text-zinc-500 italic font-normal")}>
                      {phone || "No phone number"}
                    </span>
                  </div>

                  {/* Branch */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100/60 dark:bg-zinc-900 flex items-center justify-center text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-[16px]">location_city</span>
                    </div>
                    <span className={cn("truncate flex-1", !branchId && "text-slate-400 dark:text-zinc-500 italic font-normal")}>
                      {selectedBranchName}
                    </span>
                  </div>

                  {/* Qualification */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100/60 dark:bg-zinc-900 flex items-center justify-center text-slate-400 shrink-0">
                      <span className="material-symbols-outlined text-[16px]">school</span>
                    </div>
                    <span className={cn("truncate flex-1", !qualification && "text-slate-400 dark:text-zinc-500 italic font-normal")}>
                      {qualification || "No qualifications"}
                    </span>
                  </div>

                </div>

              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column - Step Form Body */}
        <div className="lg:col-span-8 bg-white/70 dark:bg-zinc-950/70 border border-slate-200/50 dark:border-zinc-800/50 backdrop-blur-md shadow-xl rounded-2xl p-6 md:p-8">
          
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Step 1 Content: Basic Profile */}
            {activeStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">person</span>
                    Basic Profile
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Provide primary personal details and contact information for the staff member.
                  </p>
                </div>

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
                    <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-0.5">
                      Gender
                    </label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger fullWidth className="h-[48px] rounded-[8px] border-slate-200 dark:border-zinc-800 bg-transparent hover:border-slate-300 transition-colors">
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
              </div>
            )}

            {/* Step 2 Content: Professional Details */}
            {activeStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">work</span>
                    Professional Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Specify the branch assignment, primary job role, and join date.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-0.5">
                      Role <span className="text-error">*</span>
                    </label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger fullWidth className="h-[48px] rounded-[8px] border-slate-200 dark:border-zinc-800 bg-transparent hover:border-slate-300 transition-colors">
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

                  {isSuperAdmin ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-0.5">
                        Branch <span className="text-error">*</span>
                      </label>
                      <Select value={branchId} onValueChange={setBranchId}>
                        <SelectTrigger fullWidth className="h-[48px] rounded-[8px] border-slate-200 dark:border-zinc-800 bg-transparent hover:border-slate-300 transition-colors">
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
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <TextField
                    label="Join Date"
                    type="date"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    leadingIcon="calendar_today"
                    error={errors.joinDate}
                    fullWidth
                  />

                  {mode === "edit" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-0.5">
                        Status
                      </label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger fullWidth className="h-[48px] rounded-[8px] border-slate-200 dark:border-zinc-800 bg-transparent hover:border-slate-300 transition-colors">
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
              </div>
            )}

            {/* Step 3 Content: Security Desk & Permissions Matrix */}
            {activeStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[22px]">lock</span>
                      Security Desk
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      Manage system access, initial password, and custom permission overrides.
                    </p>
                  </div>
                  {!initialData?.userId && (
                    <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200/50 dark:border-zinc-800 px-4 py-2 rounded-xl">
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Enable Login</span>
                      <Switch checked={createAccount} onCheckedChange={setCreateAccount} />
                    </div>
                  )}
                </div>

                {createAccount && !initialData?.userId && (
                  <div className="space-y-4 p-5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/10 animate-in fade-in duration-300">
                    <div className="flex gap-3 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                      <span className="material-symbols-outlined text-[20px] shrink-0 text-indigo-500">info</span>
                      <span>Enabling login allows this member to log in with their email address and the password specified below.</span>
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

                {/* Custom Permissions Overrides matrix */}
                <div className={cn("space-y-4 transition-opacity duration-300", (!createAccount && !initialData?.userId) && "opacity-50 pointer-events-none")}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                        Access Permissions
                        {Object.keys(customPermissions).length > 0 && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                            {Object.keys(customPermissions).length} Custom Override{Object.keys(customPermissions).length > 1 ? 's' : ''}
                          </span>
                        )}
                      </h4>
                      {!createAccount && !initialData?.userId && (
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">Enable login access above to customize these permissions.</p>
                      )}
                    </div>
                  </div>

                  {!roleId ? (
                    <div className="text-xs text-slate-400 dark:text-zinc-500 py-8 px-4 bg-slate-50/50 dark:bg-zinc-950/50 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center font-medium">
                      Please select a role in Step 2 to view and customize permissions.
                    </div>
                  ) : allPermissions.length > 0 ? (
                    <div className="space-y-4">
                      {/* Search and Filters */}
                      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-zinc-800/80">
                        <div className="relative w-full sm:max-w-[200px]">
                          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-[18px]">search</span>
                          <input
                            type="text"
                            placeholder="Search modules..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:border-primary text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 text-sm h-8"
                          />
                        </div>
                        
                        <div className="flex gap-2 items-center w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setFilterMode('all')}
                            className={cn(
                              "px-3 py-1 rounded-lg text-xs font-semibold transition-all h-8",
                              filterMode === 'all'
                                ? 'bg-primary text-on-primary shadow-sm'
                                : 'bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                            )}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterMode('custom')}
                            className={cn(
                              "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 h-8",
                              filterMode === 'custom'
                                ? 'bg-primary text-on-primary shadow-sm'
                                : 'bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                            )}
                          >
                            <span>Overridden</span>
                            {Object.keys(customPermissions).length > 0 && (
                              <span className="rounded-full px-1.5 py-0.25 text-[9px] font-bold bg-amber-500 text-on-primary">
                                {Object.keys(customPermissions).length}
                              </span>
                            )}
                          </button>
                          {Object.keys(customPermissions).length > 0 && (
                            <button
                              type="button"
                              onClick={handleResetAllOverrides}
                              className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100/50 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-lg transition-all flex items-center gap-1 h-8 border border-rose-200/50 dark:border-rose-900/30"
                            >
                              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                              Reset All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dense Table Matrix */}
                      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
                        <div className="overflow-x-auto max-h-[350px] scrollbar-thin">
                          <table className="w-full border-collapse text-left table-fixed">
                            <thead className="sticky top-0 z-10">
                              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-bold text-slate-500 dark:text-zinc-400 select-none">
                                <th className="p-2.5 pl-3 w-[26%] truncate">Module</th>
                                
                                <th className="p-2.5 text-center w-[13%]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleColumn('read')}
                                    className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-bold w-full"
                                    title="Toggle View permission"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                    <span className="hidden sm:inline">View</span>
                                  </button>
                                </th>
                                
                                <th className="p-2.5 text-center w-[13%]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleColumn('create')}
                                    className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-bold w-full"
                                    title="Toggle Create permission"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                    <span className="hidden sm:inline">Create</span>
                                  </button>
                                </th>
                                
                                <th className="p-2.5 text-center w-[13%]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleColumn('update')}
                                    className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-bold w-full"
                                    title="Toggle Edit permission"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                    <span className="hidden sm:inline">Edit</span>
                                  </button>
                                </th>
                                
                                <th className="p-2.5 text-center w-[13%]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleColumn('delete')}
                                    className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-bold w-full"
                                    title="Toggle Delete permission"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                    <span className="hidden sm:inline">Delete</span>
                                  </button>
                                </th>
                                
                                <th className="p-2.5 text-center w-[14%]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleColumn('special')}
                                    className="hover:text-primary inline-flex items-center justify-center gap-1 py-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors font-bold w-full"
                                    title="Toggle Special Actions"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">stars</span>
                                    <span className="hidden sm:inline">Special</span>
                                  </button>
                                </th>
                                
                                <th className="p-2.5 text-center w-[8%]">All</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
                              {filteredModules.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-zinc-500 font-medium">
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
                                        <td className="p-1.5 text-center text-slate-300 dark:text-zinc-800 select-none font-mono">
                                          —
                                        </td>
                                      );
                                    }
                                    
                                    const roleHasIt = rolePermissionIds.has(p.id);
                                    const hasOverride = customPermissions[p.id] !== undefined;
                                    const isGranted = hasOverride ? customPermissions[p.id] : roleHasIt;
                                    
                                    return (
                                      <td className="p-1.5 text-center">
                                        <div className="inline-flex flex-col items-center justify-center select-none">
                                          <div className="relative inline-flex items-center justify-center">
                                            <Checkbox
                                              checked={isGranted}
                                              disabled={!createAccount && !initialData?.userId}
                                              onChange={() => {
                                                if (createAccount || initialData?.userId) {
                                                  handleTogglePermission(p.id, roleHasIt);
                                                }
                                              }}
                                              className={cn(
                                                "transition-all duration-200 rounded-[4px] border w-4 h-4",
                                                hasOverride
                                                  ? isGranted
                                                    ? "border-amber-500 bg-amber-500 checked:bg-amber-500 checked:border-amber-500 text-on-primary ring-2 ring-amber-500/20"
                                                    : "border-amber-500/70 border-dashed hover:border-amber-500 checked:bg-transparent"
                                                  : isGranted
                                                  ? "border-primary bg-primary checked:bg-primary text-on-primary"
                                                  : "border-slate-300 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600"
                                              )}
                                              title={p.description || `${p.action} permission`}
                                            />
                                            {hasOverride && (
                                              <span 
                                                className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 border border-white dark:border-zinc-950 rounded-full" 
                                                title="Custom Override Applied" 
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  };
                                  
                                  return (
                                    <tr 
                                      key={moduleName} 
                                      className={cn(
                                        "hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors group/row",
                                        hasAnyOverride && "bg-amber-500/[0.01]"
                                      )}
                                    >
                                      <td className="p-2.5 pl-3 font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap overflow-hidden">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                          <span className={cn(
                                            "material-symbols-outlined text-[16px] shrink-0",
                                            hasAnyOverride ? "text-amber-500" : "text-slate-400 group-hover/row:text-primary transition-colors"
                                          )}>
                                            {MODULE_ICONS[moduleName] || "extension"}
                                          </span>
                                          <span className="capitalize font-semibold tracking-tight truncate" title={moduleName.replace(/_/g, " ")}>
                                            {moduleName.replace(/_/g, " ")}
                                          </span>
                                        </div>
                                      </td>
                                      
                                      {renderCheckboxCell(pRead)}
                                      {renderCheckboxCell(pCreate)}
                                      {renderCheckboxCell(pUpdate)}
                                      {renderCheckboxCell(pDelete)}
                                      {renderCheckboxCell(pSpecial, true)}
                                      
                                      <td className="p-1 text-center whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRow(moduleName, perms)}
                                          className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                          title="Toggle Row"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">done_all</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Aesthetic Legend */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-slate-200/40 dark:border-zinc-850">
                        <span className="font-bold uppercase tracking-wider text-[9px] text-slate-400">Legend:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-[3px] bg-primary flex items-center justify-center text-[8px] text-white">✓</div>
                          <span>Inherited Grant</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-[3px] border border-slate-300 dark:border-zinc-800 bg-transparent" />
                          <span>Inherited Deny</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-[3px] bg-amber-500 flex items-center justify-center text-[8px] text-white relative">
                            ✓
                            <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-amber-500 rounded-full border border-white dark:border-zinc-950" />
                          </div>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">Custom Grant</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-[3px] border border-dashed border-amber-500 bg-transparent relative">
                            <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-amber-500 rounded-full border border-white dark:border-zinc-950" />
                          </div>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">Custom Revoke</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200/60 dark:border-zinc-800/80">
              <div>
                {activeStep > 1 && (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setActiveStep((prev) => (prev - 1) as 1 | 2 | 3)}
                    icon="arrow_back"
                    className="rounded-full border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 px-5 text-xs font-semibold"
                  >
                    Back
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="text"
                  onClick={() => router.push("/staff")}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 font-semibold text-xs"
                >
                  Cancel
                </Button>

                {activeStep < 3 ? (
                  <Button
                    type="button"
                    variant="filled"
                    onClick={handleContinue}
                    icon="chevron_right"
                    iconPosition="trailing"
                    className="px-6 rounded-full text-xs font-semibold"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="filled"
                    loading={loading}
                    icon={mode === "create" ? "add" : "check"}
                    className="px-8 rounded-full text-xs font-semibold shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20"
                  >
                    {mode === "create" ? "Create Staff Profile" : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
}
