"use client";

import { Icon } from "@/components/ui/icon";

interface StatsProps {
  stats: {
    inquiryCount: number;
    activeCount: number;
    submittedCount: number;
    pendingVerify: number;
    awaitingExam: number;
    readyToEnroll: number;
  };
  hasInqAccess: boolean;
  hasAppAccess: boolean;
  activeTab: "applications" | "inquiries";
  stageFilter: string;
  onStageClick: (stage: any) => void;
}

export default function AdmissionsStats({
  stats,
  hasInqAccess,
  hasAppAccess,
  activeTab,
  stageFilter,
  onStageClick,
}: StatsProps) {
  return (
    <div
      className={`grid gap-4 shrink-0 transition-all duration-300 ${
        hasAppAccess
          ? "grid-cols-2 md:grid-cols-5"
          : "grid-cols-1 md:grid-cols-1 max-w-xs"
      }`}
    >
      {/* Step 1: Counselor Inquiries */}
      {hasInqAccess && (
        <button
          onClick={() => onStageClick("inquiries")}
          className={`group relative text-left p-5 border rounded-3xl transition-all duration-300 bg-white dark:bg-zinc-900 border-sky-100 dark:border-sky-950/40 hover:border-sky-300 dark:hover:border-sky-900 hover:shadow-lg hover:shadow-sky-500/5 ${
            activeTab === "inquiries"
              ? "ring-2 ring-sky-500 border-sky-500 bg-gradient-to-br from-sky-50/40 to-sky-100/10 dark:from-sky-950/20 dark:to-sky-900/5 shadow-md"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`p-3 rounded-2xl bg-sky-50 text-sky-600 transition-all duration-300 group-hover:scale-110 ${
                activeTab === "inquiries" ? "bg-sky-500 text-white shadow-md shadow-sky-500/20" : ""
              }`}
            >
              <Icon name="group_add" size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-sky-500/80 uppercase">Step 1</span>
          </div>
          <span className="block text-3xl font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight">
            {stats.inquiryCount}
          </span>
          <span className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mt-1">
            Inquiries
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate mt-0.5">
            Counselor lead desk
          </span>
        </button>
      )}

      {/* Step 2: Submitted Applications */}
      {hasAppAccess && (
        <button
          onClick={() => onStageClick("SUBMITTED")}
          className={`group relative text-left p-5 border rounded-3xl transition-all duration-300 bg-white dark:bg-zinc-900 border-blue-100 dark:border-blue-950/40 hover:border-blue-300 dark:hover:border-blue-900 hover:shadow-lg hover:shadow-blue-500/5 ${
            activeTab === "applications" && stageFilter === "SUBMITTED"
              ? "ring-2 ring-blue-500 border-blue-500 bg-gradient-to-br from-blue-50/40 to-blue-100/10 dark:from-blue-950/20 dark:to-blue-900/5 shadow-md"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`p-3 rounded-2xl bg-blue-50 text-blue-600 transition-all duration-300 group-hover:scale-110 ${
                activeTab === "applications" && stageFilter === "SUBMITTED" ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : ""
              }`}
            >
              <Icon name="app_registration" size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-blue-500/80 uppercase">Step 2</span>
          </div>
          <span className="block text-3xl font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight">
            {stats.submittedCount}
          </span>
          <span className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mt-1">
            Submitted
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate mt-0.5">
            Initial review intake
          </span>
        </button>
      )}

      {/* Step 3: Document Verification */}
      {hasAppAccess && (
        <button
          onClick={() => onStageClick("DOCUMENT_VERIFICATION")}
          className={`group relative text-left p-5 border rounded-3xl transition-all duration-300 bg-white dark:bg-zinc-900 border-amber-100 dark:border-amber-950/40 hover:border-amber-300 dark:hover:border-amber-900 hover:shadow-lg hover:shadow-amber-500/5 ${
            activeTab === "applications" && stageFilter === "DOCUMENT_VERIFICATION"
              ? "ring-2 ring-amber-500 border-amber-500 bg-gradient-to-br from-amber-50/40 to-amber-100/10 dark:from-amber-950/20 dark:to-amber-900/5 shadow-md"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`p-3 rounded-2xl bg-amber-50 text-amber-600 transition-all duration-300 group-hover:scale-110 ${
                activeTab === "applications" && stageFilter === "DOCUMENT_VERIFICATION" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : ""
              }`}
            >
              <Icon name="check_circle" size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-amber-500/80 uppercase">Step 3</span>
          </div>
          <span className="block text-3xl font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight">
            {stats.pendingVerify}
          </span>
          <span className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mt-1">
            Verify Docs
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate mt-0.5">
            Pending clerk review
          </span>
        </button>
      )}

      {/* Step 4: Entrance Test */}
      {hasAppAccess && (
        <button
          onClick={() => onStageClick("TEST_SCHEDULED")}
          className={`group relative text-left p-5 border rounded-3xl transition-all duration-300 bg-white dark:bg-zinc-900 border-purple-100 dark:border-purple-950/40 hover:border-purple-300 dark:hover:border-purple-900 hover:shadow-lg hover:shadow-purple-500/5 ${
            activeTab === "applications" && stageFilter === "TEST_SCHEDULED"
              ? "ring-2 ring-purple-500 border-purple-500 bg-gradient-to-br from-purple-50/40 to-purple-100/10 dark:from-purple-950/20 dark:to-purple-900/5 shadow-md"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`p-3 rounded-2xl bg-purple-50 text-purple-600 transition-all duration-300 group-hover:scale-110 ${
                activeTab === "applications" && stageFilter === "TEST_SCHEDULED" ? "bg-purple-500 text-white shadow-md shadow-purple-500/20" : ""
              }`}
            >
              <Icon name="event" size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-purple-500/80 uppercase">Step 4</span>
          </div>
          <span className="block text-3xl font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight">
            {stats.awaitingExam}
          </span>
          <span className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mt-1">
            Entrance Exam
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate mt-0.5">
            Exam scores & reviews
          </span>
        </button>
      )}

      {/* Step 5: Shortlist/Enroll */}
      {hasAppAccess && (
        <button
          onClick={() => onStageClick("SHORTLISTED")}
          className={`group relative text-left p-5 border rounded-3xl transition-all duration-300 bg-white dark:bg-zinc-900 border-teal-100 dark:border-teal-950/40 hover:border-teal-300 dark:hover:border-teal-900 hover:shadow-lg hover:shadow-teal-500/5 ${
            activeTab === "applications" && stageFilter === "SHORTLISTED"
              ? "ring-2 ring-teal-500 border-teal-500 bg-gradient-to-br from-teal-50/40 to-teal-100/10 dark:from-teal-950/20 dark:to-teal-900/5 shadow-md"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`p-3 rounded-2xl bg-teal-50 text-teal-600 transition-all duration-300 group-hover:scale-110 ${
                activeTab === "applications" && stageFilter === "SHORTLISTED" ? "bg-teal-500 text-white shadow-md shadow-teal-500/20" : ""
              }`}
            >
              <Icon name="star" size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-teal-500/80 uppercase">Step 5</span>
          </div>
          <span className="block text-3xl font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight">
            {stats.readyToEnroll}
          </span>
          <span className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mt-1">
            Shortlisted
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate mt-0.5">
            Ready for enrollment
          </span>
        </button>
      )}
    </div>
  );
}
