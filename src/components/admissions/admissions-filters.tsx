"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";

interface ClassItem {
  id: string;
  name: string;
}

interface FiltersProps {
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

export default function AdmissionsFilters({
  activeTab,
  classFilter,
  setClassFilter,
  classes,
  searchQuery,
  setSearchQuery,
  includeArchives,
  setIncludeArchives,
  includeAppliedInquiries,
  setIncludeAppliedInquiries,
  hasInqAccess,
  canVerifyDocs,
  onNewInquiryClick,
  onNewApplicationClick,
  hasDemoData,
  isClearingDemo,
  onClearDemoClick,
}: FiltersProps) {
  return (
    <div className="flex flex-col space-y-4 p-6 rounded-[24px] bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/40 shadow-sm md:flex-row md:items-end md:space-y-0 md:justify-between gap-4">
      <div className="flex flex-wrap items-center gap-4 flex-1">
        {/* Grade filter */}
        {activeTab === "applications" && (
          <div className="w-52 shrink-0">
            <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-zinc-500 mb-1.5">
              Applied Grade
            </label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger fullWidth className="h-11 rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 hover:bg-slate-50 dark:hover:bg-zinc-900 text-sm font-semibold">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Grades</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Search bar */}
        <div className="flex-1 min-w-[280px]">
          <label className="block text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-zinc-500 mb-1.5">
            Search Candidate
          </label>
          <div className="relative group">
            <SearchBar
              placeholder={
                activeTab === "applications"
                  ? "Search by candidate name, application No, parent..."
                  : "Search by inquirer name, parent name, phone..."
              }
              value={searchQuery}
              onChange={setSearchQuery}
              className="h-11 rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 group-focus-within:border-primary transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Action switches and Add buttons */}
      <div className="flex flex-wrap items-center gap-3 self-end md:self-auto shrink-0">
        {/* Archives / Converted Toggle */}
        {activeTab === "applications" ? (
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/60 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <input
              type="checkbox"
              checked={includeArchives}
              onChange={(e) => setIncludeArchives(e.target.checked)}
              className="rounded text-primary border-slate-300 dark:border-zinc-700 focus:ring-primary w-4.5 h-4.5 transition-all"
            />
            Show Archives
          </label>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/60 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <input
              type="checkbox"
              checked={includeAppliedInquiries}
              onChange={(e) => setIncludeAppliedInquiries(e.target.checked)}
              className="rounded text-primary border-slate-300 dark:border-zinc-700 focus:ring-primary w-4.5 h-4.5 transition-all"
            />
            Show Converted
          </label>
        )}

        {/* Action Buttons */}
        {hasDemoData && (
          <Button
            variant="outlined"
            icon="delete"
            loading={isClearingDemo}
            onClick={onClearDemoClick}
            className="h-11 rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-950/40 dark:text-red-400 dark:hover:bg-red-950/20 px-5 text-sm"
          >
            Clear Demo
          </Button>
        )}
        {hasInqAccess && (
          <Button
            variant="tonal"
            icon="group_add"
            onClick={onNewInquiryClick}
            className="h-11 rounded-xl font-bold px-5 text-sm"
          >
            New Inquiry
          </Button>
        )}
        {canVerifyDocs && (
          <Button
            variant="filled"
            icon="add"
            onClick={onNewApplicationClick}
            className="h-11 rounded-xl font-bold bg-primary text-white hover:bg-primary/95 px-5 text-sm shadow-md shadow-primary/15"
          >
            New Application
          </Button>
        )}
      </div>
    </div>
  );
}
