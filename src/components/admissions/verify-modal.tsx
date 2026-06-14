"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface DocumentItem {
  id: string;
  documentType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  remarks: string;
}

interface VerifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  applicationNo: string;
  verifyForm: {
    documents: DocumentItem[];
    verificationNotes: string;
    nextStatus: "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
  };
  setVerifyForm: (val: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  hasEntranceTest: boolean;
}

export default function VerifyModal({
  open,
  onOpenChange,
  candidateName,
  applicationNo,
  verifyForm,
  setVerifyForm,
  onSubmit,
  loading,
  hasEntranceTest,
}: VerifyModalProps) {
  const handleDocStatusChange = (index: number, status: "PENDING" | "VERIFIED" | "REJECTED") => {
    const nextDocs = [...verifyForm.documents];
    nextDocs[index] = { ...nextDocs[index], status };
    
    // Auto-update candidate next status recommendations
    const allVerified = nextDocs.every((d) => d.status === "VERIFIED");
    const anyRejected = nextDocs.some((d) => d.status === "REJECTED");
    let recommendedNextStatus: typeof verifyForm.nextStatus = "DOCUMENT_VERIFICATION";

    if (anyRejected) {
      recommendedNextStatus = "REJECTED";
    } else if (allVerified) {
      recommendedNextStatus = hasEntranceTest ? "TEST_SCHEDULED" : "SHORTLISTED";
    }

    setVerifyForm((prev: any) => ({
      ...prev,
      documents: nextDocs,
      nextStatus: recommendedNextStatus,
    }));
  };

  const handleDocRemarksChange = (index: number, remarks: string) => {
    const nextDocs = [...verifyForm.documents];
    nextDocs[index] = { ...nextDocs[index], remarks };
    setVerifyForm((prev: any) => ({ ...prev, documents: nextDocs }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b border-slate-50 dark:border-zinc-800/60 pb-4 shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              Document Verification Checklist
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              Verify files for candidate <strong className="text-slate-700 dark:text-zinc-300">{candidateName} ({applicationNo})</strong>
            </DialogDescription>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Documents Checklist Card Grid */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Uploaded Documents Checklist
            </h4>
            
            {verifyForm.documents.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-2xl text-slate-400 bg-slate-50/50">
                <Icon name="upload" size={24} className="opacity-40 mb-1" />
                <p className="text-xs font-bold">No documents uploaded by applicant.</p>
                <p className="text-[10px] opacity-60 mt-0.5">Please add notes and proceed with Direct Shortlist or Rejection.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {verifyForm.documents.map((doc, index) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/20 dark:bg-zinc-950/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-xl bg-white dark:bg-zinc-900 border text-slate-500 dark:text-zinc-400">
                        <Icon name="menu_book" size={16} />
                      </span>
                      <div>
                        <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                          {doc.documentType}
                        </span>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                          Status: <strong className={
                            doc.status === "VERIFIED"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : doc.status === "REJECTED"
                              ? "text-red-500"
                              : "text-amber-500"
                          }>{doc.status}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Check/Cross selectors & remarks input */}
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        placeholder="Add remarks..."
                        value={doc.remarks}
                        onChange={(e) => handleDocRemarksChange(index, e.target.value)}
                        className="w-48 h-10 px-3 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-slate-850 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300 font-semibold"
                      />

                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => handleDocStatusChange(index, "VERIFIED")}
                          className={`p-1.5 px-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                            doc.status === "VERIFIED"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          <Icon name="check" size={12} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDocStatusChange(index, "REJECTED")}
                          className={`p-1.5 px-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                            doc.status === "REJECTED"
                              ? "bg-red-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          <Icon name="close" size={12} />
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDocStatusChange(index, "PENDING")}
                          className={`p-1.5 px-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                            doc.status === "PENDING"
                              ? "bg-amber-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          <Icon name="lock_reset" size={12} />
                          Hold
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
              Internal Verification Office Notes
            </label>
            <textarea
              rows={3}
              value={verifyForm.verificationNotes}
              onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, verificationNotes: e.target.value }))}
              placeholder="Log details on mismatch corrections, additional document requests, etc."
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
                  value={verifyForm.nextStatus}
                  onValueChange={(val: any) => setVerifyForm((prev: any) => ({ ...prev, nextStatus: val }))}
                >
                  <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                    <SelectValue placeholder="Select Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOCUMENT_VERIFICATION">Keep at Doc Check (Pending)</SelectItem>
                    {hasEntranceTest && <SelectItem value="TEST_SCHEDULED">Entrance Exam desk (Approved)</SelectItem>}
                    <SelectItem value="SHORTLISTED">Direct Shortlist (Ready to Promote)</SelectItem>
                    <SelectItem value="REJECTED">Reject Applicant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-500 flex items-center pl-1">
                <span>
                  {verifyForm.nextStatus === "TEST_SCHEDULED"
                    ? "✨ Recommends scheduling school aptitude testing."
                    : verifyForm.nextStatus === "SHORTLISTED"
                    ? "✨ Recommends promoting candidate directly to SIS enrollment."
                    : verifyForm.nextStatus === "REJECTED"
                    ? "⚠️ Will move applicant to Rejected archive logs."
                    : "✨ Keeps applicant in current Verification folder."}
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
              Save Verification Logs
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
