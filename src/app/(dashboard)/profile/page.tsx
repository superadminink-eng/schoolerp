"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { useSnackbar } from "@/components/ui/snackbar";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; name: string };
  isActive: boolean;
  createdAt: string;
  branch: { id: string; name: string } | null;
  organization: { id: string; name: string; slug: string; plan: string };
}

interface AuditLogData {
  id: string;
  action: string;
  module: string;
  entityId: string;
  details: any;
  createdAt: string;
}

type TabType = "general" | "permissions" | "security";

const categories = [
  {
    id: "academics",
    label: "Core Academics",
    icon: "school",
    modules: ["admissions", "students", "staff", "classes", "subjects", "timetable", "attendance", "exams"],
  },
  {
    id: "operations",
    label: "Operations & Portal",
    icon: "payments",
    modules: ["fees", "notices", "events", "reports"],
  },
  {
    id: "admin",
    label: "System & Services",
    icon: "settings",
    modules: ["users", "branches", "academic_years", "settings", "transport", "library", "hostel"],
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [user, setUser] = useState<UserData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogData[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search & Filter for permissions
  const [permSearch, setPermSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Load profile details & permissions
  useEffect(() => {
    // Detect theme from localStorage or document class
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    async function loadData() {
      try {
        // Fetch profile and audit logs
        const profileRes = await fetch("/api/v1/profile");
        const profileData = await profileRes.json();

        if (profileData.success && profileData.data) {
          setUser(profileData.data.user);
          setName(profileData.data.user.name);
          setPhone(profileData.data.user.phone ?? "");
          setAuditLogs(profileData.data.auditLogs ?? []);
        } else {
          snackbar.show("Failed to load profile details", "error");
        }

        // Fetch permissions
        const permRes = await fetch("/api/v1/me/permissions");
        const permData = await permRes.json();
        if (permData.success && permData.data) {
          const perms = permData.data.permissions ?? [];
          setPermissions(perms);
          if (perms.length > 0) {
            const firstModule = perms[0].split(":")[0];
            setSelectedModule(firstModule);
          }
        }
      } catch (error) {
        console.error("Load profile data error:", error);
        snackbar.show("An error occurred while loading settings", "error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [snackbar]);

  // Handle Profile Update
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!name.trim()) {
      setErrors({ name: "Full Name is required" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setUser(data.data);
        snackbar.show("Profile details updated successfully", "success");
        router.refresh();
      } else {
        snackbar.show(data.error?.message ?? "Failed to update profile", "error");
      }
    } catch (error) {
      console.error("Save profile error:", error);
      snackbar.show("An error occurred while saving profile", "error");
    } finally {
      setSaving(false);
    }
  }

  // Handle Theme Change
  function toggleTheme(newTheme: "light" | "dark") {
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      snackbar.show("Dark mode enabled", "success");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      snackbar.show("Light mode enabled", "success");
    }
  }

  // Handle Password Reset
  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetting(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, user.email);
      snackbar.show(`Secure password reset link sent to ${user.email}`, "success");
    } catch (error: any) {
      console.error("Password reset error:", error);
      snackbar.show(error.message ?? "Failed to send reset link", "error");
    } finally {
      setResetting(false);
    }
  }

  // Group permissions by module
  const groupedPermissions = Object.entries(
    permissions.reduce((acc, perm) => {
      const [module, action] = perm.split(":");
      if (!acc[module]) acc[module] = [];
      acc[module].push(action);
      return acc;
    }, {} as Record<string, string[]>)
  ).filter(([module]) => module.toLowerCase().includes(permSearch.toLowerCase()));

  const activeSelectedModule = selectedModule && groupedPermissions.some(([m]) => m === selectedModule)
    ? selectedModule
    : (groupedPermissions[0]?.[0] ?? null);

  const categorizedModules = categories.map((cat) => {
    const matchingModules = groupedPermissions.filter(([modName]) => 
      cat.modules.includes(modName)
    );
    return {
      ...cat,
      modules: matchingModules,
    };
  }).filter((cat) => cat.modules.length > 0);

  const categorizedModNames = categories.flatMap(c => c.modules);
  const otherModules = groupedPermissions.filter(([modName]) => !categorizedModNames.includes(modName));

  if (otherModules.length > 0) {
    categorizedModules.push({
      id: "other",
      label: "Other Modules",
      icon: "shield",
      modules: otherModules,
    });
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[48px] animate-spin text-primary">
            progress_activity
          </span>
          <p className="text-body-lg text-on-surface-variant font-medium tracking-wide">
            Accessing Secure Settings Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-body-lg text-error font-medium">
          Settings dashboard could not load. Please log in again.
        </p>
      </div>
    );
  }

  const initials = getInitials(user.name);
  const formattedRole = formatRoleName(user.role.name);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16 animate-in fade-in-50 duration-500">
      {/* Silicon Valley Style User Profile Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-800 to-teal-950 p-6 shadow-elevation-2 text-white border border-teal-700/20">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-600/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-teal-400 to-sky-300 opacity-75 blur-md transition duration-500 group-hover:opacity-100" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-700 to-teal-950 border-4 border-white text-display-sm font-black tracking-wider text-white shadow-xl">
              {initials}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center sm:justify-start">
              <h2 className="text-headline-sm font-black tracking-tight">{user.name}</h2>
              <span className="mx-auto sm:mx-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md text-teal-200 border border-white/10 shadow-sm uppercase tracking-wider">
                {formattedRole}
              </span>
            </div>
            <p className="text-body-md text-teal-100/80 font-medium">{user.email}</p>
            <p className="text-body-sm text-teal-200/50 font-medium">
              Registered Institution: <strong className="text-white">{user.organization.name}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-outline-variant gap-2 overflow-x-auto pb-px scrollbar-none">
        <button
          onClick={() => setActiveTab("general")}
          className={cn(
            "flex items-center gap-2 px-5 py-3.5 text-body-md font-bold transition-all relative cursor-pointer outline-none whitespace-nowrap",
            activeTab === "general"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/10"
          )}
        >
          <Icon name="manage_accounts" size={20} />
          Profile & Account
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          className={cn(
            "flex items-center gap-2 px-5 py-3.5 text-body-md font-bold transition-all relative cursor-pointer outline-none whitespace-nowrap",
            activeTab === "permissions"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/10"
          )}
        >
          <Icon name="verified_user" size={20} />
          Live Permission visualizer
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={cn(
            "flex items-center gap-2 px-5 py-3.5 text-body-md font-bold transition-all relative cursor-pointer outline-none whitespace-nowrap",
            activeTab === "security"
              ? "text-primary border-b-2 border-primary"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/10"
          )}
        >
          <Icon name="security" size={20} />
          Security Audit Timeline
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-4 animate-in fade-in-30 slide-in-from-bottom-2 duration-300">
        
        {/* ==================== TAB 1: GENERAL & THEME ==================== */}
        {activeTab === "general" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Left Col: Workspace & Appearance */}
            <div className="md:col-span-1 space-y-6">
              {/* Workplace info */}
              <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-1">
                <div className="border-b border-outline-variant px-5 py-4 bg-surface-dim/40">
                  <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Icon name="domain" size={18} className="text-primary" />
                    Workplace Details
                  </h3>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">Organization</span>
                    <p className="text-body-md font-bold text-on-surface">{user.organization.name}</p>
                    <span className="mt-1 inline-block px-2 py-0.5 rounded-sm text-[9px] font-black bg-primary-container text-on-primary-container uppercase tracking-wider">
                      {user.organization.plan} PLAN
                    </span>
                  </div>
                  <div className="h-px bg-outline-variant/50" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">Branch</span>
                    <p className="text-body-md font-bold text-on-surface">{user.branch?.name ?? "Main Branch"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Silicon Valley Theme Selector */}
              <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-1">
                <div className="border-b border-outline-variant px-5 py-4 bg-surface-dim/40">
                  <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Icon name="palette" size={18} className="text-primary" />
                    Theme Mode
                  </h3>
                </div>
                <CardContent className="p-5 space-y-4">
                  <p className="text-body-sm text-on-surface-variant">Select your workspace appearance styling preference.</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Light theme trigger */}
                    <button
                      type="button"
                      onClick={() => toggleTheme("light")}
                      className={cn(
                        "flex flex-col gap-2 items-center p-3 rounded-lg border text-center transition-all cursor-pointer outline-none hover:bg-surface-variant/5",
                        theme === "light"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-outline-variant"
                      )}
                    >
                      <div className="flex h-10 w-full rounded border border-slate-200 bg-white items-center px-2 shadow-sm shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div className="ml-1.5 h-1.5 w-10 rounded-sm bg-slate-200" />
                      </div>
                      <span className="text-body-sm font-bold text-on-surface">Light Mode</span>
                    </button>

                    {/* Dark theme trigger */}
                    <button
                      type="button"
                      onClick={() => toggleTheme("dark")}
                      className={cn(
                        "flex flex-col gap-2 items-center p-3 rounded-lg border text-center transition-all cursor-pointer outline-none hover:bg-surface-variant/5",
                        theme === "dark"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-outline-variant"
                      )}
                    >
                      <div className="flex h-10 w-full rounded border border-slate-800 bg-[#1C1B1F] items-center px-2 shadow-sm shrink-0">
                        <div className="h-2 w-2 rounded-full bg-teal-400" />
                        <div className="ml-1.5 h-1.5 w-10 rounded-sm bg-slate-700" />
                      </div>
                      <span className="text-body-sm font-bold text-on-surface">Dark Mode</span>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Personal Details & Security Action */}
            <div className="md:col-span-2 space-y-6">
              {/* Personal details edit card */}
              <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-1">
                <div className="border-b border-outline-variant px-5 py-4 bg-surface-dim/40">
                  <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Icon name="person" size={18} className="text-primary" />
                    Personal Information
                  </h3>
                </div>
                <CardContent className="p-6">
                  <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

                      <TextField
                        label="Phone Number"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        leadingIcon="phone"
                        fullWidth
                        autoComplete="tel"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <TextField
                        label="Email Address (Login ID)"
                        type="email"
                        value={user.email}
                        leadingIcon="mail"
                        disabled
                        fullWidth
                      />

                      <TextField
                        label="Role Assignment"
                        value={formattedRole}
                        leadingIcon="badge"
                        disabled
                        fullWidth
                      />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-outline-variant/60 gap-3">
                      <Button
                        type="submit"
                        variant="filled"
                        loading={saving}
                        icon="check"
                        className="hover:scale-[1.02] hover:shadow-lg transition-all"
                      >
                        Save Personal Details
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Login Security & Password Resets */}
              <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-1">
                <div className="border-b border-outline-variant px-5 py-4 bg-surface-dim/40">
                  <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Icon name="vpn_key" size={18} className="text-primary" />
                    Account Security & Credentials
                  </h3>
                </div>
                <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-body-md font-bold text-on-surface">Change Account Password</h4>
                    <p className="text-body-sm text-on-surface-variant max-w-lg">
                      Trigger a secure, encrypted password reset link directly to your registered email address (`{user.email}`).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="tonal"
                    loading={resetting}
                    icon="send"
                    onClick={handlePasswordReset}
                    className="shrink-0 cursor-pointer"
                  >
                    Send Reset Email
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: RBAC VISUALIZER ==================== */}
        {activeTab === "permissions" && (
          <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-1 overflow-hidden">
            <div className="border-b border-outline-variant p-5 bg-surface-dim/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <Icon name="shield" size={18} className="text-primary" />
                  Live Access Explorer
                </h3>
                <p className="text-body-sm text-on-surface-variant">
                  Detailed visual inventory of permissions granted under your current role as <strong className="text-primary">{formattedRole}</strong>.
                </p>
              </div>

              {/* Premium search bar */}
              <div className="w-full sm:w-64">
                <TextField
                  label="Search Modules"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  leadingIcon="search"
                  fullWidth
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row min-h-[500px]">
              {/* Left Column: Modules List with Categorized View */}
              <div className="w-full md:w-[320px] border-r border-outline-variant bg-surface-bright/20 dark:bg-surface-container-low/10 overflow-y-auto max-h-[550px] p-3 space-y-4">
                {categorizedModules.length === 0 ? (
                  <div className="text-center py-12 text-on-surface-variant space-y-2">
                    <Icon name="search_off" size={36} className="mx-auto text-slate-300" />
                    <p className="text-body-md font-bold text-on-surface-variant">No modules found</p>
                  </div>
                ) : (
                  categorizedModules.map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex items-center gap-2 px-3 py-1">
                        <Icon name={cat.icon} size={14} className="text-on-surface-variant/40" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50">
                          {cat.label}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {cat.modules.map(([modName, actions]) => {
                          const meta = moduleMeta[modName] || {
                            label: modName.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
                            icon: "shield",
                            desc: `Access control settings for the ${modName} module.`,
                          };
                          const isActive = activeSelectedModule === modName;
                          
                          return (
                            <button
                              key={modName}
                              onClick={() => setSelectedModule(modName)}
                              className={cn(
                                "w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg transition-all duration-200 outline-none cursor-pointer group border-l-2",
                                isActive
                                  ? "bg-teal-50/80 dark:bg-teal-950/20 text-teal-900 dark:text-teal-200 border-l-teal-600 dark:border-l-teal-400 font-bold"
                                  : "hover:bg-surface-variant/20 text-on-surface-variant hover:text-on-surface border-l-transparent"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",
                                  isActive
                                    ? "bg-teal-600 text-white border-transparent shadow-sm shadow-teal-500/20"
                                    : "bg-white dark:bg-surface border-outline-variant text-on-surface-variant group-hover:border-slate-300 group-hover:text-on-surface"
                                )}>
                                  <Icon name={meta.icon} size={15} />
                                </div>
                                <div className="min-w-0">
                                  <p className={cn(
                                    "text-body-sm font-bold truncate leading-tight",
                                    isActive ? "text-teal-950 dark:text-teal-100" : "text-on-surface"
                                  )}>
                                    {meta.label}
                                  </p>
                                  <p className="text-[9px] font-medium text-on-surface-variant/50 truncate mt-0.5">
                                    {actions.length} permissions
                                  </p>
                                </div>
                              </div>
                              <Icon 
                                name="chevron_right" 
                                size={14} 
                                className={cn(
                                  "transition-transform duration-200 text-on-surface-variant/30 group-hover:text-on-surface/60 shrink-0 ml-1",
                                  isActive && "text-teal-600 dark:text-teal-400 translate-x-0.5"
                                )} 
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Column: Module Detail Panel */}
              <div className="flex-1 p-6 md:p-8 bg-surface-bright/40 dark:bg-surface-container-high/20 overflow-y-auto max-h-[550px]">
                {activeSelectedModule ? (() => {
                  const modName = activeSelectedModule;
                  const grantedActions = groupedPermissions.find(([m]) => m === modName)?.[1] ?? [];
                  const meta = moduleMeta[modName] || {
                    label: modName.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
                    icon: "shield",
                    desc: `Access control settings for the ${modName} module.`,
                  };
                  
                  // Get list of all possible actions for this module
                  const possibleActions = moduleActions[modName] || ["read", "create", "update", "delete"];
                  const percent = Math.round((grantedActions.length / possibleActions.length) * 100);

                  return (
                    <div className="space-y-6 animate-in fade-in-30 slide-in-from-right-3 duration-300">
                      {/* Module Header Card with premium gradient banner/background */}
                      <div className="relative overflow-hidden rounded-xl border border-teal-200/40 dark:border-teal-900/40 bg-gradient-to-r from-teal-50 to-emerald-50/30 dark:from-teal-950/10 dark:to-emerald-950/5 p-5">
                        <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-teal-500/5 blur-xl" />
                        
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-500/20">
                              <Icon name={meta.icon} size={24} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-headline-sm font-black text-on-surface tracking-tight">{meta.label}</h2>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200/30 uppercase tracking-wider">
                                  Module Profile
                                </span>
                              </div>
                              <p className="text-body-sm text-on-surface-variant font-medium leading-relaxed max-w-xl">{meta.desc}</p>
                            </div>
                          </div>
                          
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <div className="text-body-sm font-black text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                              {grantedActions.length} of {possibleActions.length} Authorized
                            </div>
                            <span className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-wider">{percent}% Access Level</span>
                          </div>
                        </div>

                        {/* Premium Progress Bar */}
                        <div className="mt-5 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-black text-on-surface-variant/60 uppercase tracking-wider">
                            <span>Security Access Level</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-200/60 dark:bg-slate-800 h-2 rounded-full overflow-hidden p-px">
                            <div 
                              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${percent}%` }} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Capabilities Grid */}
                      <div className="space-y-4">
                        <h4 className="text-label-md font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                          <Icon name="verified_user" size={16} className="text-primary" />
                          Module Capabilities
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {possibleActions.map((actionKey) => {
                            const isGranted = grantedActions.includes(actionKey);
                            const actionInfo = actionMeta[actionKey] || {
                              label: actionKey.charAt(0).toUpperCase() + actionKey.slice(1).toLowerCase(),
                              desc: `Authorized to perform ${actionKey} actions on this module.`,
                              type: "write",
                            };

                            return (
                              <div
                                key={actionKey}
                                className={cn(
                                  "flex gap-4.5 p-4 rounded-xl border transition-all duration-300 relative overflow-hidden",
                                  isGranted
                                    ? "bg-gradient-to-br from-teal-50/30 to-white dark:from-teal-950/10 dark:to-surface-container border-teal-200 dark:border-teal-900/60 shadow-elevation-1 hover:shadow-elevation-2"
                                    : "bg-surface-dim/20 dark:bg-surface-container-low/20 border-outline-variant/30 opacity-60"
                                )}
                              >
                                {isGranted && (
                                  <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-teal-500/5 to-teal-500/0 rounded-bl-full" />
                                )}
                                
                                <div className="shrink-0 mt-0.5">
                                  <div className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all duration-300",
                                    isGranted
                                      ? "bg-teal-500/10 border-teal-200 text-teal-600 dark:text-teal-400 shadow-sm shadow-teal-500/10"
                                      : "bg-slate-100 dark:bg-slate-800 border-outline-variant text-slate-400"
                                  )}>
                                    <Icon name={isGranted ? "check" : "lock"} size={16} filled={isGranted} />
                                  </div>
                                </div>

                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={cn(
                                      "text-body-sm font-black truncate",
                                      isGranted ? "text-on-surface" : "text-on-surface-variant/80"
                                    )}>
                                      {actionInfo.label}
                                    </p>
                                    <span className={cn(
                                      "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0",
                                      isGranted
                                        ? "bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                                    )}>
                                      {actionKey}
                                    </span>
                                  </div>
                                  <p className={cn(
                                    "text-body-sm leading-relaxed",
                                    isGranted ? "text-on-surface-variant" : "text-on-surface-variant/60"
                                  )}>
                                    {actionInfo.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-on-surface-variant space-y-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/50 text-slate-300 dark:text-slate-700 animate-pulse border border-slate-200/50 dark:border-slate-800">
                      <Icon name="shield" size={32} />
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="text-body-md font-black">No module selected</p>
                      <p className="text-body-sm text-on-surface-variant/60 max-w-xs leading-normal">
                        Select any functional module from the left category panel to audit its active access policies.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ==================== TAB 3: AUDIT TIMELINE ==================== */}
        {activeTab === "security" && (
          <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-1">
            <div className="border-b border-outline-variant p-5 bg-surface-dim/40">
              <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <Icon name="history" size={18} className="text-primary" />
                Security Audit Log
              </h3>
              <p className="text-body-sm text-on-surface-variant">
                Your last 10 security actions, modifications, and access traces.
              </p>
            </div>

            <CardContent className="p-6">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant space-y-2">
                  <Icon name="verified" size={48} className="mx-auto text-slate-300" />
                  <p className="text-body-lg font-bold">Your Security Log is clean</p>
                  <p className="text-body-sm">No actions recorded in this session yet.</p>
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-outline-variant/60 ml-2 space-y-8 py-2">
                  {auditLogs.map((log) => {
                    const isDelete = log.action === "DELETE";
                    const isCreate = log.action === "CREATE";
                    const isUpdate = log.action === "UPDATE";
                    
                    return (
                      <div key={log.id} className="relative group">
                        {/* Timeline dot */}
                        <span className={cn(
                          "absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white dark:bg-surface-container",
                          isDelete ? "border-red-500" : isCreate ? "border-teal-500" : isUpdate ? "border-sky-500" : "border-slate-400"
                        )} />

                        <div className="space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2.5">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                isDelete 
                                  ? "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                                  : isCreate
                                    ? "bg-teal-100 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300"
                                    : "bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
                              )}>
                                {log.action}
                              </span>
                              <span className="text-body-md font-bold text-on-surface">
                                Modified {log.module}
                              </span>
                            </div>
                            <span className="text-body-sm text-on-surface-variant font-medium">
                              {new Date(log.createdAt).toLocaleString("en-US", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                          </div>

                          <div className="text-body-sm text-on-surface-variant pl-1 bg-surface-dim/20 rounded p-2 text-[12px] leading-normal font-mono border border-slate-100 dark:border-slate-800">
                            <strong>Target Entity ID:</strong> {log.entityId}
                            {log.details && (
                              <div className="mt-1">
                                <strong>Changes:</strong> {JSON.stringify(log.details)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  if (!name) return "";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRoleName(roleName: string): string {
  if (!roleName) return "";
  return roleName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const moduleMeta: Record<string, { label: string; icon: string; desc: string }> = {
  students: {
    label: "Students Portal",
    icon: "school",
    desc: "Manage student profiles, registrations, class rosters, and demographics.",
  },
  staff: {
    label: "Staff & Faculty",
    icon: "group",
    desc: "Configure faculty directory, employee status, and academic/department assignments.",
  },
  attendance: {
    label: "Attendance Tracking",
    icon: "date_range",
    desc: "Record daily student attendance, manage leave requests, and compile summaries.",
  },
  fees: {
    label: "Fee Ledger",
    icon: "payments",
    desc: "Manage transaction receipts, setup tuition fee structures, and audit collections.",
  },
  exams: {
    label: "Exams & Grading",
    icon: "menu_book",
    desc: "Schedule term exams, publish report card marks, and analyze overall GPA metrics.",
  },
  timetable: {
    label: "Academic Timetable",
    icon: "event",
    desc: "Design weekly lecture schedules, assign classrooms, and handle substitutions.",
  },
  transport: {
    label: "Bus Logistics",
    icon: "location_city",
    desc: "Set bus routes, log driver registry, and assign pick-up/drop milestones.",
  },
  library: {
    label: "Library Catalog",
    icon: "menu_book",
    desc: "Catalog available books, record lending checkouts, and log overdue fines.",
  },
  hostel: {
    label: "Dormitories & Lodging",
    icon: "domain",
    desc: "Manage residential rooms, student hostel boarding, and mess schedules.",
  },
  notices: {
    label: "Notice Board",
    icon: "campaign",
    desc: "Publish portal-wide announcements, emergency notices, and circular broadcasts.",
  },
  events: {
    label: "Events Calendar",
    icon: "celebration",
    desc: "Publish upcoming institutional functions, extracurricular events, and galleries.",
  },
  reports: {
    label: "Analytics Hub",
    icon: "analytics",
    desc: "Inspect consolidated audits, demographical trends, and administrative statistics.",
  },
  settings: {
    label: "System Settings",
    icon: "settings",
    desc: "Adjust regional preferences, organization branding profiles, and ERP defaults.",
  },
  subjects: {
    label: "Subjects Registry",
    icon: "menu_book",
    desc: "Configure standard course catalogs, lesson syllabus parameters, and criteria.",
  },
  classes: {
    label: "Classes & Sectioning",
    icon: "class",
    desc: "Setup classroom sections, grade hierarchies, and teacher supervisor links.",
  },
  academic_years: {
    label: "Academic Calendar",
    icon: "date_range",
    desc: "Define active sessions, structure school term bounds, and rollover term transitions.",
  },
  branches: {
    label: "Campus Branches",
    icon: "domain",
    desc: "Configure regional campus profiles, physical coordinates, and settings.",
  },
  users: {
    label: "System Users",
    icon: "people",
    desc: "Manage system account details, security roles, and active status overrides.",
  },
};

const actionMeta: Record<string, { label: string; desc: string; type: "read" | "write" | "manage" }> = {
  read: {
    label: "Inspect & View",
    desc: "Permits reading specific records, accessing directory lists, and loading logs.",
    type: "read",
  },
  view: {
    label: "Inspect & View",
    desc: "Permits reading specific records, accessing directory lists, and loading logs.",
    type: "read",
  },
  create: {
    label: "Register & Add",
    desc: "Permits adding new profiles, uploading documents, and setting up initial data.",
    type: "write",
  },
  write: {
    label: "Create & Edit",
    desc: "Permits adding new profiles, uploading documents, and updating basic data.",
    type: "write",
  },
  update: {
    label: "Modify & Update",
    desc: "Permits updating existing profiles, modifying logs, and status transitions.",
    type: "write",
  },
  delete: {
    label: "Retire & Delete",
    desc: "Permits archival or removal of records from active system indexes.",
    type: "manage",
  },
  manage: {
    label: "Administrative Override",
    desc: "Permits critical parameter tweaks, database overrides, and setting modifications.",
    type: "manage",
  },
  approve: {
    label: "Signoff Transactions",
    desc: "Permits approving fee transactions, waiving balances, or signing off leaves.",
    type: "write",
  },
  grade: {
    label: "Grade Marks",
    desc: "Permits publishing report cards, adjusting term grades, and final GPA entries.",
    type: "write",
  },
  export: {
    label: "Export CSV/PDF",
    desc: "Permits downloading local copies of reports and directories.",
    type: "read",
  },
};

const moduleActions: Record<string, string[]> = {
  students: ["read", "create", "update", "delete"],
  staff: ["read", "create", "update", "delete"],
  attendance: ["read", "create", "update"],
  fees: ["read", "create", "update", "approve"],
  exams: ["read", "create", "update", "grade"],
  timetable: ["read", "manage"],
  transport: ["read", "manage"],
  library: ["read", "manage"],
  hostel: ["read", "manage"],
  notices: ["read", "create", "update", "delete"],
  events: ["read", "create", "update", "delete"],
  reports: ["view", "export"],
  settings: ["manage"],
  subjects: ["read", "create", "update", "delete"],
  classes: ["read", "create", "update", "delete"],
  academic_years: ["read", "create", "update", "delete"],
  branches: ["read", "manage"],
  users: ["read", "create", "update", "delete"],
};


