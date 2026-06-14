"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface ExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  applicationNo: string;
  examForm: {
    examDate: string;
    maxMarks: number;
    marksObtained: string;
    verdict: "PENDING" | "PASS" | "FAIL" | "BORDERLINE";
    notes: string;
    applicationStatus: "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
  };
  setExamForm: (val: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function ExamModal({
  open,
  onOpenChange,
  candidateName,
  applicationNo,
  examForm,
  setExamForm,
  onSubmit,
  loading,
}: ExamModalProps) {
  const handleChange = (field: string, value: any) => {
    setExamForm((prev: any) => {
      const next = { ...prev, [field]: value };
      
      // Auto-recommend applicationStatus based on exam verdict
      if (field === "verdict") {
        if (value === "PASS") {
          next.applicationStatus = "SHORTLISTED";
        } else if (value === "FAIL") {
          next.applicationStatus = "REJECTED";
        } else {
          next.applicationStatus = "TEST_SCHEDULED";
        }
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b border-slate-50 dark:border-zinc-800/60 pb-4 shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              Aptitude Entrance Exam Scorecard
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              Schedule test dates, log score marks, and set evaluation verdicts for <strong className="text-slate-700 dark:text-zinc-300">{candidateName} ({applicationNo})</strong>
            </DialogDescription>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Exam Date */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Examination Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={examForm.examDate}
                onChange={(e) => handleChange("examDate", e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Max Marks */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Maximum Marks <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                value={String(examForm.maxMarks)}
                onChange={(e) => handleChange("maxMarks", e.target.value)}
                placeholder="e.g. 100"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Marks Obtained */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Marks Obtained
              </label>
              <input
                type="number"
                value={examForm.marksObtained}
                onChange={(e) => handleChange("marksObtained", e.target.value)}
                placeholder="Leave blank if scheduled"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>
          </div>

          {/* Verdict Selector Cards (Premium Choice Grid) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
              Evaluation Test Verdict
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "PASS", name: "Pass Selection", icon: "check_circle", color: "border-emerald-100 text-emerald-700 bg-emerald-50/20 dark:border-emerald-900/40 dark:text-emerald-400", activeBg: "bg-emerald-600 dark:bg-emerald-500", activeText: "text-white" },
                { id: "FAIL", name: "Fail", icon: "cancel", color: "border-red-100 text-red-700 bg-red-50/20 dark:border-red-900/40 dark:text-red-400", activeBg: "bg-red-500", activeText: "text-white" },
                { id: "BORDERLINE", name: "Borderline", icon: "warning", color: "border-amber-100 text-amber-700 bg-amber-50/20 dark:border-amber-900/40 dark:text-amber-400", activeBg: "bg-amber-500", activeText: "text-white" },
                { id: "PENDING", name: "Pending / Hold", icon: "lock_reset", color: "border-slate-100 text-slate-600 bg-slate-50/20 dark:border-zinc-800 dark:text-zinc-400", activeBg: "bg-slate-500", activeText: "text-white" }
              ].map((v) => {
                const isActive = examForm.verdict === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleChange("verdict", v.id)}
                    className={`p-4 border rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all duration-300 font-bold text-xs ${
                      isActive
                        ? `${v.activeBg} ${v.activeText} shadow-md`
                        : `${v.color} hover:shadow-sm hover:scale-[1.02]`
                    }`}
                  >
                    <Icon name={v.icon} size={20} className={isActive ? "text-white" : ""} />
                    <span>{v.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
              Evaluator Comments / Remarks
            </label>
            <textarea
              rows={3}
              value={examForm.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Write details on aptitude, communication levels, behavior checks, etc."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300 resize-none"
            />
          </div>

          <div className="p-5 rounded-2xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-3.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
              Next Stage Workflow Transition
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative w-full">
                <Select
                  value={examForm.applicationStatus}
                  onValueChange={(val: any) => handleChange("applicationStatus", val)}
                >
                  <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                    <SelectValue placeholder="Select Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEST_SCHEDULED">Keep at Entrance Exam (Pending/Hold)</SelectItem>
                    <SelectItem value="SHORTLISTED">Promote to Shortlisted Desk (Passed)</SelectItem>
                    <SelectItem value="REJECTED">Move to Rejected Archives (Failed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-500 flex items-center pl-1">
                <span>
                  {examForm.applicationStatus === "SHORTLISTED"
                    ? "✨ Promotes candidate to final Registrar Desk selection."
                    : examForm.applicationStatus === "REJECTED"
                    ? "⚠️ Moves candidate to Rejected archive logs."
                    : "✨ Keeps candidate under test evaluations."}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800 shrink-0">
            <DialogClose asChild>
              <Button variant="outlined" className="rounded-xl h-11 px-5">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="filled"
              icon="check"
              loading={loading}
              className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 shadow-md shadow-primary/15"
            >
              Log Examination Results
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
