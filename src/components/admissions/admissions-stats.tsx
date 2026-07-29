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
  hasEntranceTest: boolean;
  activeTab: "applications" | "inquiries";
  stageFilter: string;
  onStageClick: (stage: any) => void;
}

export default function AdmissionsStats({
  stats,
  hasInqAccess,
  hasAppAccess,
  hasEntranceTest,
  activeTab,
  stageFilter,
  onStageClick,
}: StatsProps) {
  const cards = [];

  if (hasInqAccess) {
    cards.push({
      id: "inquiries",
      title: "Inquiries",
      count: stats.inquiryCount,
      icon: "group_add",
      color: "sky",
      isActive: activeTab === "inquiries",
      onClick: () => onStageClick("inquiries"),
    });
  }

  if (hasAppAccess) {
    cards.push({
      id: "SUBMITTED",
      title: "Submitted",
      count: stats.submittedCount,
      icon: "app_registration",
      color: "blue",
      isActive: activeTab === "applications" && stageFilter === "SUBMITTED",
      onClick: () => onStageClick("SUBMITTED"),
    });

    cards.push({
      id: "DOCUMENT_VERIFICATION",
      title: "Verify Docs",
      count: stats.pendingVerify,
      icon: "check_circle",
      color: "amber",
      isActive: activeTab === "applications" && stageFilter === "DOCUMENT_VERIFICATION",
      onClick: () => onStageClick("DOCUMENT_VERIFICATION"),
    });

    if (hasEntranceTest) {
      cards.push({
        id: "TEST_SCHEDULED",
        title: "Exam",
        count: stats.awaitingExam,
        icon: "event",
        color: "purple",
        isActive: activeTab === "applications" && stageFilter === "TEST_SCHEDULED",
        onClick: () => onStageClick("TEST_SCHEDULED"),
      });
    }

    cards.push({
      id: "SHORTLISTED",
      title: "Shortlisted",
      count: stats.readyToEnroll,
      icon: "star",
      color: "teal",
      isActive: activeTab === "applications" && stageFilter === "SHORTLISTED",
      onClick: () => onStageClick("SHORTLISTED"),
    });
  }

  const colorMap: Record<string, { activeBg: string, activeBorder: string, activeText: string, iconActiveBg: string }> = {
    sky: {
      activeBg: "bg-sky-50 dark:bg-sky-500/10",
      activeBorder: "border-sky-200 dark:border-sky-500/30",
      activeText: "text-sky-700 dark:text-sky-300",
      iconActiveBg: "bg-sky-500 text-white",
    },
    blue: {
      activeBg: "bg-blue-50 dark:bg-blue-500/10",
      activeBorder: "border-blue-200 dark:border-blue-500/30",
      activeText: "text-blue-700 dark:text-blue-300",
      iconActiveBg: "bg-blue-500 text-white",
    },
    amber: {
      activeBg: "bg-amber-50 dark:bg-amber-500/10",
      activeBorder: "border-amber-200 dark:border-amber-500/30",
      activeText: "text-amber-700 dark:text-amber-300",
      iconActiveBg: "bg-amber-500 text-white",
    },
    purple: {
      activeBg: "bg-purple-50 dark:bg-purple-500/10",
      activeBorder: "border-purple-200 dark:border-purple-500/30",
      activeText: "text-purple-700 dark:text-purple-300",
      iconActiveBg: "bg-purple-500 text-white",
    },
    teal: {
      activeBg: "bg-teal-50 dark:bg-teal-500/10",
      activeBorder: "border-teal-200 dark:border-teal-500/30",
      activeText: "text-teal-700 dark:text-teal-300",
      iconActiveBg: "bg-teal-500 text-white",
    }
  };

  return (
    <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full pb-1">
      {cards.map((card) => {
        const theme = colorMap[card.color];
        return (
          <button
            key={card.id}
            onClick={card.onClick}
            className={`group flex flex-1 items-center justify-between gap-2 p-2 rounded-xl transition-all duration-200 border min-w-[130px] ${
              card.isActive
                ? `${theme.activeBg} ${theme.activeBorder} shadow-sm ring-1 ring-inset ring-current`
                : "bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/60 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                card.isActive ? theme.iconActiveBg : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 group-hover:bg-slate-200"
              }`}>
                <Icon name={card.icon} size={16} />
              </div>
              
              <div className="flex flex-col text-left overflow-hidden">
                <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${card.isActive ? theme.activeText : "text-slate-500 dark:text-zinc-400"}`}>
                  {card.title}
                </span>
                <span className={`text-lg font-black leading-none mt-0.5 ${card.isActive ? theme.activeText : "text-slate-800 dark:text-zinc-100"}`}>
                  {card.count}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
