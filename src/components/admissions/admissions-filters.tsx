"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface ClassItem {
  id: string;
  name: string;
}

export interface FiltersProps {
  activeTab: "applications" | "inquiries";
  classFilter: string;
  setClassFilter: (val: string) => void;
  classes: ClassItem[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  includeArchives: boolean;
  setIncludeArchives: (val: boolean) => void;
  includeAppliedInquiries: boolean;
  setIncludeAppliedInquiries: (val: boolean) => void;
  hasInqAccess: boolean;
  canVerifyDocs: boolean;
  onNewInquiryClick: () => void;
  onNewApplicationClick: () => void;
  hasDemoData: boolean;
  isClearingDemo: boolean;
  onClearDemoClick: () => void;
}

export function AdmissionsSearch({
  activeTab,
  classFilter,
  setClassFilter,
  classes,
  searchQuery,
  setSearchQuery,
}: FiltersProps) {
  return (
    <div className="flex items-center bg-white dark:bg-zinc-900 rounded-xl shadow-[0_1px_3px_rgb(0,0,0,0.1)] border border-slate-200/80 dark:border-zinc-800 h-10 w-full max-w-[200px] xl:max-w-[280px] overflow-hidden transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 shrink-0">
      <Icon name="search" size={16} className="text-slate-400 ml-2.5 shrink-0" />
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1 bg-transparent h-full px-2 text-sm font-medium text-slate-800 dark:text-zinc-200 outline-none placeholder:text-slate-400 min-w-0"
      />
      
      {activeTab === "applications" && (
        <>
          <div className="w-px h-5 bg-slate-200 dark:bg-zinc-800 shrink-0 mx-1"></div>
          <div className="shrink-0 w-28">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-10 border-none bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-none shadow-none text-xs font-bold text-slate-600 dark:text-zinc-400 focus:ring-0 px-2">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="font-bold text-xs">All Grades</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

export function AdmissionsDataToggles({
  activeTab,
  includeArchives,
  setIncludeArchives,
  includeAppliedInquiries,
  setIncludeAppliedInquiries,
}: FiltersProps) {
  return (
    <div className="flex items-center gap-2 px-3 h-10 bg-white dark:bg-zinc-900 rounded-xl shadow-[0_1px_3px_rgb(0,0,0,0.1)] border border-slate-200/80 dark:border-zinc-800 shrink-0">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
        {activeTab === "applications" ? "Archives" : "Converted"}
      </span>
      <button
        type="button"
        role="switch"
        onClick={() => activeTab === "applications" ? setIncludeArchives(!includeArchives) : setIncludeAppliedInquiries(!includeAppliedInquiries)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
          (activeTab === "applications" ? includeArchives : includeAppliedInquiries) ? "bg-primary" : "bg-slate-300 dark:bg-zinc-700"
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 shadow-sm ${
          (activeTab === "applications" ? includeArchives : includeAppliedInquiries) ? "translate-x-4.5" : "translate-x-1"
        }`} />
      </button>
    </div>
  );
}

export function AdmissionsGlobalActions({
  hasInqAccess,
  canVerifyDocs,
  onNewInquiryClick,
  onNewApplicationClick,
  hasDemoData,
  isClearingDemo,
  onClearDemoClick,
}: FiltersProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {hasDemoData && (
        <Button
          variant="outlined"
          icon="delete_sweep"
          loading={isClearingDemo}
          onClick={onClearDemoClick}
          className="h-9 rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-50 text-xs px-3"
        >
          Clear
        </Button>
      )}
      
      {hasInqAccess && (
        <Button
          variant="tonal"
          icon="add"
          onClick={onNewInquiryClick}
          className="h-9 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 shadow-sm"
        >
          Inquiry
        </Button>
      )}

      {canVerifyDocs && (
        <Button
          variant="filled"
          icon="rocket_launch"
          onClick={onNewApplicationClick}
          className="h-9 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-xs px-4 shadow-sm"
        >
          New App
        </Button>
      )}
    </div>
  );
}
