"use client";

import React from "react";
import { Icon } from "@/components/ui/icon";

interface ClassItem {
  id: string;
  name: string;
}

export interface Application {
  id: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  status: string;
  class?: { name: string } | null;
  createdAt?: string; // used for sorting if needed
  [key: string]: any; // Allow other properties
}

export interface Inquiry {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  status: string;
  createdAt: string;
  classApplied?: { name: string } | null;
  [key: string]: any; // Allow other properties
}

interface UnifiedListProps {
  applications: any[];
  inquiries: any[];
  activeTab: "applications" | "inquiries";
  stageFilter: string;
  onStageClick: (stage: any) => void;
  selectedAppId: string | null;
  selectedInqId: string | null;
  onSelectApp: (app: any) => void;
  onSelectInquiry: (inq: any) => void;
  stats: any;
  hasInqAccess: boolean;
  hasAppAccess: boolean;
  hasEntranceTest: boolean;
}

export function UnifiedInboxList({
  applications,
  inquiries,
  activeTab,
  stageFilter,
  onStageClick,
  selectedAppId,
  selectedInqId,
  onSelectApp,
  onSelectInquiry,
  stats,
  hasInqAccess,
  hasAppAccess,
  hasEntranceTest,
}: UnifiedListProps) {
  
  // Build WhatsApp style tabs
  const tabs = [];
  if (hasInqAccess) {
    tabs.push({ id: "inquiries", label: "Inquiries", count: stats.inquiryCount });
  }
  if (hasAppAccess) {
    tabs.push({ id: "SUBMITTED", label: "Intake", count: stats.submittedCount });
    tabs.push({ id: "DOCUMENT_VERIFICATION", label: "Docs", count: stats.pendingVerify });
    if (hasEntranceTest) {
      tabs.push({ id: "TEST_SCHEDULED", label: "Exams", count: stats.awaitingExam });
    }
    tabs.push({ id: "SHORTLISTED", label: "Shortlisted", count: stats.readyToEnroll });
  }

  // Helper to generate deterministic avatar colors
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
      "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700",
      "bg-pink-100 text-pink-700", "bg-sky-100 text-sky-700"
    ];
    let hash = 0;
    if (!name) return colors[0];
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    if (!name) return "NA";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffHours > 48;
  };

  // Determine which list to render
  const isViewingInquiries = activeTab === "inquiries" || stageFilter === "inquiries";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950/80">
      
      {/* WhatsApp Style Tabs Row */}
      <div className="flex items-center overflow-x-auto hide-scrollbar gap-1.5 px-3 py-2.5 border-b border-slate-200/50 dark:border-zinc-800/50 shrink-0 bg-slate-50/50 dark:bg-zinc-900/50">
        {tabs.map(tab => {
          const isActive = (activeTab === "inquiries" && tab.id === "inquiries") || 
                           (activeTab === "applications" && stageFilter === tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => onStageClick(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0 ${
                isActive 
                  ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm" 
                  : "bg-white dark:bg-zinc-900 text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                isActive 
                  ? "bg-white/20 text-white dark:bg-black/10 dark:text-slate-900" 
                  : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isViewingInquiries ? (
          // RENDER INQUIRIES
          inquiries.length === 0 ? (
            <EmptyListState message="No pending inquiries found." icon="inbox" />
          ) : (
            <ul className="flex flex-col">
              {inquiries.map((inq) => {
                const isSelected = selectedInqId === inq.id;
                const overdue = isOverdue(inq.createdAt) && inq.status !== "APPLIED";
                
                return (
                  <li 
                    key={inq.id}
                    onClick={() => onSelectInquiry(inq)}
                    className={`relative py-3.5 px-5 cursor-pointer transition-all duration-200 group flex items-start gap-3.5 min-w-0 border-b border-slate-100/50 dark:border-zinc-800/30 ${
                      isSelected ? "bg-slate-100/80 dark:bg-zinc-900/80" : "hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-800 dark:bg-white rounded-r-md"></div>}
                    <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold tracking-wider shadow-sm border border-white/50 ${getAvatarColor(inq.studentName)}`}>
                      {getInitials(inq.studentName)}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-11">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`font-bold text-sm tracking-tight truncate pr-2 transition-colors ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-zinc-200"}`}>
                          {inq.studentName}
                        </span>
                        {overdue && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>}
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400">
                        <span className="truncate pr-2 font-medium">{inq.parentName || "—"}</span>
                        <span className="shrink-0 text-[10px] font-semibold">{inq.classApplied?.name || ""}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          // RENDER APPLICATIONS
          applications.length === 0 ? (
            <EmptyListState message="No applications found in this stage." icon="assignment" />
          ) : (
            <ul className="flex flex-col">
              {applications.map((app) => {
                const isSelected = selectedAppId === app.id;
                const fullName = `${app.firstName} ${app.lastName}`;
                
                return (
                  <li 
                    key={app.id}
                    onClick={() => onSelectApp(app)}
                    className={`relative py-3.5 px-5 cursor-pointer transition-all duration-200 group flex items-start gap-3.5 min-w-0 border-b border-slate-100/50 dark:border-zinc-800/30 ${
                      isSelected ? "bg-slate-100/80 dark:bg-zinc-900/80" : "hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-800 dark:bg-white rounded-r-md"></div>}
                    <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold tracking-wider shadow-sm border border-white/50 ${getAvatarColor(fullName)}`}>
                      {getInitials(fullName)}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-11">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`font-bold text-sm tracking-tight truncate pr-2 transition-colors ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-zinc-200"}`}>
                          {fullName}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 border border-slate-200 dark:border-zinc-700">{app.applicationNo}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400">
                        <span className="truncate pr-2 font-medium">{app.fatherName || "—"}</span>
                        <span className="shrink-0 text-[10px] font-semibold text-primary">{app.class?.name || ""}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

function EmptyListState({ message, icon }: { message: string, icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-900 flex items-center justify-center mb-4 border border-slate-100 dark:border-zinc-800">
        <Icon name={icon} size={24} className="text-slate-300 dark:text-zinc-700" />
      </div>
      <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">All clear!</p>
      <p className="text-xs mt-1 text-slate-400 max-w-[200px]">{message}</p>
    </div>
  );
}
