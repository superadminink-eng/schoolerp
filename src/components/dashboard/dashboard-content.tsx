"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  studentName: string;
  admissionNo: string;
  amount: number;
  method: string;
  paidAt: string;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  publishedAt: string | null;
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

interface DashboardData {
  stats: {
    students: number;
    staff: number;
    branches: number;
    users: number;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    rate: number;
  };
  financials: {
    totalInvoiced: number;
    totalCollected: number;
    outstandingBalance: number;
    collectionRate: number;
    recentPayments: Payment[];
  };
  notices: Notice[];
  events: Event[];
  operations: {
    classes: number;
    sections: number;
    vehicles: number;
    books: number;
  };
  onboarding: {
    isComplete: boolean;
    steps: {
      academicYear: boolean;
      branch: boolean;
      subjectMaster: boolean;
      staff: boolean;
      class: boolean;
      section: boolean;
    };
  };
}

interface DashboardContentProps {
  userName?: string | null;
  roleName?: string | null;
  branchId?: string | null;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  progress?: number;
  color: "teal" | "emerald" | "amber" | "sky";
  onClick?: () => void;
}

function MetricCard({ title, value, subtitle, icon, progress, color, onClick }: MetricCardProps) {
  const colors = {
    teal: {
      bg: "bg-teal-500/10 border-teal-200/40 text-teal-600 dark:text-teal-400 dark:border-teal-900/60",
      bar: "bg-gradient-to-r from-teal-500 to-teal-400",
      iconBg: "bg-teal-600 text-white shadow-sm shadow-teal-500/10",
      glow: "from-teal-500/5 to-teal-500/0",
    },
    emerald: {
      bg: "bg-emerald-500/10 border-emerald-200/40 text-emerald-600 dark:text-emerald-400 dark:border-emerald-900/60",
      bar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      iconBg: "bg-emerald-600 text-white shadow-sm shadow-emerald-500/10",
      glow: "from-emerald-500/5 to-emerald-500/0",
    },
    amber: {
      bg: "bg-amber-500/10 border-amber-200/40 text-amber-600 dark:text-amber-400 dark:border-amber-900/60",
      bar: "bg-gradient-to-r from-amber-500 to-amber-400",
      iconBg: "bg-amber-600 text-white shadow-sm shadow-amber-500/10",
      glow: "from-amber-500/5 to-amber-500/0",
    },
    sky: {
      bg: "bg-sky-500/10 border-sky-200/40 text-sky-600 dark:text-sky-400 dark:border-sky-900/60",
      bar: "bg-gradient-to-r from-sky-500 to-sky-400",
      iconBg: "bg-sky-600 text-white shadow-sm shadow-sky-500/10",
      glow: "from-sky-500/5 to-sky-500/0",
    },
  }[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-outline-variant bg-white dark:bg-surface-container p-5 shadow-elevation-1 transition-all duration-300",
        onClick ? "cursor-pointer hover:shadow-elevation-2 hover:scale-[1.01] hover:border-primary/40 active:scale-[0.99]" : ""
      )}
    >
      <div className={cn("absolute top-0 right-0 h-16 w-16 bg-gradient-to-br rounded-bl-full", colors.glow)} />
      
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">{title}</span>
          <p className="text-display-xs font-black text-on-surface leading-none">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colors.iconBg)}>
          <Icon name={icon} size={20} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-body-sm text-on-surface-variant/80 font-medium">{subtitle}</span>
        {progress !== undefined && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden p-px">
            <div className={cn("h-full rounded-full transition-all duration-500", colors.bar)} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingWizard({ onboarding }: { onboarding: DashboardData["onboarding"] }) {
  const router = useRouter();
  const rawSteps = [
    {
      number: 1,
      title: "Set Academic Year",
      description: "Define active school sessions. Required to schedule classes and track timelines.",
      rawCompleted: onboarding.steps.academicYear,
      icon: "date_range",
      actionUrl: "/academic-years",
      actionLabel: "Set Academic Year",
    },
    {
      number: 2,
      title: "Add Campus Branches",
      description: "Set up physical branches. Classes, students, and staff operate inside branches.",
      rawCompleted: onboarding.steps.branch,
      icon: "domain",
      actionUrl: "/branches",
      actionLabel: "Add Branches",
    },
    {
      number: 3,
      title: "Define Subject Catalog",
      description: "Build the course subjects list. You will assign these subjects to class schedules.",
      rawCompleted: onboarding.steps.subjectMaster,
      icon: "menu_book",
      actionUrl: "/subject-masters",
      actionLabel: "Create Subjects",
    },
    {
      number: 4,
      title: "Register Faculty & Staff",
      description: "Add teachers, administrators, and staff profiles to assign to classes.",
      rawCompleted: onboarding.steps.staff,
      icon: "group",
      actionUrl: "/staff",
      actionLabel: "Register Staff",
    },
    {
      number: 5,
      title: "Configure Classes & Divisions",
      description: "Define class grades (e.g. Standard 1) and division classrooms (e.g. A, B).",
      rawCompleted: onboarding.steps.class && onboarding.steps.section,
      icon: "class",
      actionUrl: "/classes",
      actionLabel: "Create Classes",
    },
  ];

  // Silicon Valley Level Verification: Sequential Waterfall Completion
  // A step can ONLY be completed if ALL preceding steps are also completed.
  let allPreviousCompleted = true;
  const steps = rawSteps.map((step) => {
    const isCompleted = step.rawCompleted && allPreviousCompleted;
    if (!isCompleted) {
      allPreviousCompleted = false; // Block all subsequent steps from being marked as complete
    }
    return { ...step, isCompleted };
  });

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const activeStepIndex = steps.findIndex((s) => !s.isCompleted);
  const activeStep = steps[activeStepIndex] || steps[steps.length - 1];

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completedCount / 5) * circumference;

  return (
    <div className="flex flex-col lg:flex-row items-stretch rounded-2xl border border-outline-variant bg-white dark:bg-surface-container overflow-hidden shadow-elevation-1">
      {/* Left Pane: Circular Progress Ring & Title */}
      <div className="flex flex-col items-center justify-center p-6 border-b lg:border-b-0 lg:border-r border-outline-variant bg-slate-50/50 dark:bg-slate-900/10 lg:w-64 shrink-0 text-center gap-4">
        <div className="space-y-1">
          <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center justify-center gap-2">
            <Icon name="rocket_launch" size={16} className="text-primary" />
            Quick Setup
          </h3>
          
        </div>

        {/* Circular Progress Gauge */}
        <div className="relative h-20 w-20 flex items-center justify-center">
          <svg className="absolute h-full w-full transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-primary transition-all duration-500 ease-in-out"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-title-lg font-black text-on-surface leading-none">
              {Math.round((completedCount / 5) * 100)}%
            </span>
            <span className="text-[9px] font-bold text-on-surface-variant/60 mt-0.5 tracking-wider">
              {completedCount}/5 steps
            </span>
          </div>
        </div>
      </div>

      {/* Right Pane: Horizontal Stepper and Current Step details */}
      <div className="flex-1 p-6 flex flex-col justify-between gap-5 min-w-0">
        {/* Horizontal Steps Track */}
        <div className="relative flex items-center justify-between w-full px-4 mt-2">
          {/* Connector Line */}
          <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-100 dark:bg-slate-800 z-0">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(activeStepIndex / 4) * 100}%` }}
            />
          </div>

          {steps.map((step, idx) => {
            const isCompleted = step.isCompleted;
            const isActive = idx === activeStepIndex;
            const isLocked = idx > activeStepIndex;

            return (
              <div key={step.number} className="relative flex flex-col items-center z-10">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => !isLocked && router.push(step.actionUrl)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 shadow-sm cursor-pointer",
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                      : isActive
                      ? "bg-white dark:bg-surface-container border-primary text-primary hover:bg-primary/5 focus:ring-4 focus:ring-primary/10"
                      : "bg-white dark:bg-surface-container border-slate-200 text-slate-400 pointer-events-none"
                  )}
                >
                  {isCompleted ? (
                    <Icon name="check" size={18} />
                  ) : isLocked ? (
                    <Icon name="lock" size={14} />
                  ) : (
                    <Icon name={step.icon} size={16} />
                  )}
                </button>
                <span
                  className={cn(
                    "hidden sm:inline-block text-[10px] font-black uppercase tracking-wider mt-2",
                    isCompleted
                      ? "text-emerald-600"
                      : isActive
                      ? "text-primary"
                      : "text-slate-400"
                  )}
                >
                  Step {step.number}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current Step Action Card */}
        <div className="p-4 rounded-xl border border-outline-variant bg-slate-50/30 dark:bg-slate-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase bg-primary/15 text-primary px-2 py-0.5 rounded">
                Next Action Required
              </span>
              <span className="text-body-sm font-bold text-on-surface">
                {activeStep.title}
              </span>
            </div>
            <p className="text-[11.5px] text-on-surface-variant/80 max-w-xl leading-relaxed">
              {activeStep.description}
            </p>
          </div>

          <Button
            variant="filled"
            size="sm"
            icon="arrow_forward"
            onClick={() => router.push(activeStep.actionUrl)}
            className="shrink-0 hover:scale-[1.02] transition-all"
          >
            {activeStep.actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 w-full rounded-2xl bg-surface-variant/20 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-32 rounded-2xl bg-surface-variant/25 animate-pulse" />
        <div className="h-32 rounded-2xl bg-surface-variant/25 animate-pulse" />
        <div className="h-32 rounded-2xl bg-surface-variant/25 animate-pulse" />
        <div className="h-32 rounded-2xl bg-surface-variant/25 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 h-96 rounded-2xl bg-surface-variant/20 animate-pulse" />
        <div className="lg:col-span-5 h-96 rounded-2xl bg-surface-variant/20 animate-pulse" />
      </div>
    </div>
  );
}

export function DashboardContent({ userName, roleName, branchId }: DashboardContentProps) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/dashboard/stats?branchId=${branchId || ""}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setData(resData.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load dashboard stats", err);
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning";
    if (hr < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-body-lg text-error font-medium">
          Dashboard telemetry could not load. Please check your network connection.
        </p>
      </div>
    );
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "CASH": return "receipt_long";
      case "ONLINE": return "vpn_key";
      case "UPI": return "phone";
      default: return "payments";
    }
  };

  const getPaymentMethodBadgeColor = (method: string) => {
    switch (method) {
      case "ONLINE": return "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300";
      case "UPI": return "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300";
      default: return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Premium Dashboard Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-headline-md font-black tracking-tight text-on-surface">
              Overview
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Telemetry Active
            </div>
          </div>
          <p className="text-body-sm text-on-surface-variant font-medium">
            Welcome back, <span className="font-bold text-on-surface">{userName}</span>. You are logged in as <span className="font-bold text-primary uppercase text-[10px] tracking-wide bg-primary/10 px-1.5 py-0.5 rounded">{roleName?.replace("_", " ") || "Administrator"}</span>.
          </p>
        </div>

        {/* Right side calendar date badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-bright dark:bg-surface-container-low shadow-sm shrink-0">
          <Icon name="date_range" size={14} className="text-on-surface-variant/60" />
          <span className="text-body-sm font-bold text-on-surface">
            {new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
      
      {/* Onboarding Setup Wizard (Conditional) */}
      {!data.onboarding.isComplete && (
        <OnboardingWizard onboarding={data.onboarding} />
      )}

      {/* Quick Action Shortcuts Bar */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl border border-outline-variant bg-surface-bright dark:bg-surface-container-low shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
          <Icon name="sparkles" size={12} className="text-primary" />
          Quick Console Shortcuts
        </span>
        <div className="flex flex-wrap gap-3">
          <PermissionGate module="admissions" action="registrar_desk">
            <Button
              variant="tonal"
              icon="person_add"
              onClick={() => router.push("/admissions")}
              className="hover:scale-[1.02] transition-all duration-200"
            >
              Enroll Student
            </Button>
          </PermissionGate>
          <PermissionGate module="staff" action="create">
            <Button
              variant="tonal"
              icon="group_add"
              onClick={() => router.push("/staff/new")}
              className="hover:scale-[1.02] transition-all duration-200"
            >
              Register Staff
            </Button>
          </PermissionGate>
          <PermissionGate module="fees" action="create">
            <Button
              variant="tonal"
              icon="payments"
              onClick={() => router.push("/fees")}
              className="hover:scale-[1.02] transition-all duration-200"
            >
              Collect Fees
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Active Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Students"
          value={data.stats.students}
          subtitle="Enrolled Active Profiles"
          icon="school"
          color="sky"
          onClick={() => router.push("/students")}
        />
        <MetricCard
          title="Active Staff"
          value={data.stats.staff}
          subtitle="Registered Employees"
          icon="group"
          color="teal"
          onClick={() => router.push("/staff")}
        />
        <MetricCard
          title="Today's Attendance"
          value={`${data.attendance.rate}%`}
          subtitle="Daily Session Efficiency"
          progress={data.attendance.rate}
          icon="check_circle"
          color="emerald"
        />
        <MetricCard
          title="Revenue Collection"
          value={`${data.financials.collectionRate}%`}
          subtitle="Overall Fee Clearance"
          progress={data.financials.collectionRate}
          icon="payments"
          color="amber"
          onClick={() => router.push("/fees")}
        />
      </div>

      {/* Primary Visual Breakdowns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Left Widget: Financial Audit Console */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-outline-variant bg-white dark:bg-surface-container overflow-hidden shadow-elevation-1">
          <div className="border-b border-outline-variant p-5 bg-surface-dim/30 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <Icon name="payments" size={18} className="text-primary" />
                Financial Audit Console
              </h3>
              <p className="text-body-sm text-on-surface-variant">Fee invoices collection summaries & recent receipts.</p>
            </div>
            <span className="text-[10px] font-black text-amber-700 bg-amber-500/10 px-2 py-1 border border-amber-500/20 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Live Ledger
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between gap-6">
            {/* Financial summaries card */}
            <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border border-outline-variant bg-surface-bright/50 dark:bg-surface-container-low/50">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Total Invoiced</span>
                <p className="text-body-md font-black text-on-surface">₹{data.financials.totalInvoiced.toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-1 border-l border-outline-variant pl-4">
                <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Collected</span>
                <p className="text-body-md font-black text-teal-600 dark:text-teal-400">₹{data.financials.totalCollected.toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-1 border-l border-outline-variant pl-4">
                <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Outstanding</span>
                <p className="text-body-md font-black text-red-500">₹{data.financials.outstandingBalance.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Recent Payments list */}
            <div className="space-y-3.5 flex-1">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
                <Icon name="history" size={13} className="text-on-surface-variant/40" />
                Recent Fee Payments
              </h4>
              
              {data.financials.recentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant/60 border border-dashed border-outline-variant/60 rounded-xl">
                  <Icon name="receipt_long" size={24} className="text-slate-300" />
                  <p className="text-body-sm font-bold mt-1">No transaction receipts found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {data.financials.recentPayments.map((p) => (
                    <div 
                      key={p.id} 
                      className="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant/60 bg-surface-bright dark:bg-surface-container-low/40 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant", getPaymentMethodBadgeColor(p.method))}>
                          <Icon name={getPaymentMethodIcon(p.method)} size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-body-sm font-bold text-on-surface truncate leading-tight">{p.studentName}</p>
                          <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                            Adm: <span className="font-semibold">{p.admissionNo}</span> • {new Date(p.paidAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-body-sm font-black text-teal-600 dark:text-teal-400 leading-none">+₹{p.amount.toLocaleString('en-IN')}</p>
                        <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/40 mt-1 inline-block">{p.method}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Widget: Operations & Events Console */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-outline-variant bg-white dark:bg-surface-container overflow-hidden shadow-elevation-1">
          <div className="border-b border-outline-variant p-5 bg-surface-dim/30">
            <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
              <Icon name="settings" size={18} className="text-primary" />
              Operations & Events
            </h3>
            <p className="text-body-sm text-on-surface-variant">Live school services status & academic schedules.</p>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between gap-6">
            
            {/* Counts breakdown grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-bright/30 dark:bg-surface-container-low/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400">
                  <Icon name="class" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-body-md font-black text-on-surface leading-none">{data.operations.classes}</p>
                  <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Classes</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-bright/30 dark:bg-surface-container-low/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
                  <Icon name="domain" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-body-md font-black text-on-surface leading-none">{data.operations.sections}</p>
                  <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Sections</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-bright/30 dark:bg-surface-container-low/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Icon name="location_city" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-body-md font-black text-on-surface leading-none">{data.operations.vehicles}</p>
                  <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Bus Routes</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-bright/30 dark:bg-surface-container-low/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Icon name="menu_book" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-body-md font-black text-on-surface leading-none">{data.operations.books}</p>
                  <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/60">Library Books</span>
                </div>
              </div>
            </div>

            {/* Upcoming events list */}
            <div className="space-y-3.5 flex-1">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
                <Icon name="date_range" size={13} className="text-on-surface-variant/40" />
                Upcoming Academic Calendar
              </h4>
              
              {data.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant/60 border border-dashed border-outline-variant/60 rounded-xl">
                  <Icon name="event_busy" size={24} className="text-slate-300" />
                  <p className="text-body-sm font-bold mt-1">No scheduled academic events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.events.map((e) => {
                    const dt = new Date(e.startDate);
                    const day = dt.getDate();
                    const mon = dt.toLocaleString("default", { month: "short" }).toUpperCase();
                    
                    return (
                      <div key={e.id} className="flex gap-4.5 items-start p-2 rounded-xl hover:bg-surface-variant/10 transition-colors duration-200">
                        {/* Elegant Date Badge */}
                        <div className="flex flex-col items-center justify-center h-12 w-12 shrink-0 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300">
                          <span className="text-[10px] font-black uppercase tracking-wide leading-none">{mon}</span>
                          <span className="text-body-lg font-black mt-0.5 leading-none">{day}</span>
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-body-sm font-bold text-on-surface truncate">{e.title}</p>
                          <p className="text-[11px] text-on-surface-variant/70 leading-normal line-clamp-1">{e.description || "School function & activity details."}</p>
                          {e.location && (
                            <span className="text-[9px] font-bold text-on-surface-variant/50 flex items-center gap-1">
                              <Icon name="location_city" size={10} />
                              {e.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Notice Board Feed */}
      <div className="flex flex-col rounded-2xl border border-outline-variant bg-white dark:bg-surface-container overflow-hidden shadow-elevation-1">
        <div className="border-b border-outline-variant p-5 bg-surface-dim/30">
          <h3 className="text-label-lg font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
            <Icon name="campaign" size={18} className="text-primary" />
            Portal Bulletin Board
          </h3>
          <p className="text-body-sm text-on-surface-variant">Portal announcements, bulletins, and broadcast notices.</p>
        </div>

        <div className="p-6">
          {data.notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant/60 border border-dashed border-outline-variant/60 rounded-xl">
              <Icon name="campaign" size={32} className="text-slate-300" />
              <p className="text-body-md font-bold mt-2">Notice board is clear</p>
              <p className="text-body-sm text-on-surface-variant/60">No institutional announcements posted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data.notices.map((n) => (
                <div 
                  key={n.id} 
                  className="flex flex-col justify-between p-4.5 rounded-xl border border-outline-variant/70 bg-gradient-to-br from-surface-bright to-white dark:from-surface-container-low dark:to-surface-container hover:shadow-sm transition-all duration-200 relative overflow-hidden"
                >
                  <div className="absolute right-0 top-0 h-10 w-10 bg-gradient-to-br from-teal-500/5 to-transparent rounded-bl-full" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black uppercase tracking-wider text-teal-600 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                        Published Notice
                      </span>
                      <span className="text-[10px] text-on-surface-variant/50 font-bold">
                        {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-body-sm font-black text-on-surface line-clamp-1">{n.title}</h4>
                    <p className="text-body-sm text-on-surface-variant/85 leading-relaxed line-clamp-3">{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
