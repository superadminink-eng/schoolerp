"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface FollowUp {
  id: string;
  followUpDate: string;
  conversationNotes: string;
  nextFollowUpDate: string | null;
  statusReached: string;
}

interface Inquiry {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  status: string;
  createdAt: string;
  dateOfBirth: string;
  gender: string;
  notes: string | null;
  source: string;
  classApplied?: { id: string; name: string } | null;
  followUps?: FollowUp[];
}

interface InquiryWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedInquiry: Inquiry | null;
  followUpForm: {
    conversationNotes: string;
    nextFollowUpDate: string;
    statusReached: string;
  };
  setFollowUpForm: (val: any) => void;
  onSubmitFollowUp: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function InquiryWorkspace({
  open,
  onOpenChange,
  selectedInquiry,
  followUpForm,
  setFollowUpForm,
  onSubmitFollowUp,
  loading,
}: InquiryWorkspaceProps) {
  if (!selectedInquiry) return null;

  const handleFieldChange = (field: string, value: string) => {
    setFollowUpForm((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/20 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-100/40">
                Inquiry Details
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mx-1"></span>
              <span className="text-xs font-semibold text-slate-400">Status:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100/40">
                {selectedInquiry.status}
              </span>
            </div>
            <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-zinc-100 mt-1.5">
              Counselor Desk: {selectedInquiry.studentName}
            </DialogTitle>
          </div>
        </div>

        {/* Split Pane Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel: Profile Details */}
          <div className="w-[35%] overflow-y-auto p-6 bg-slate-50/50 dark:bg-zinc-950/10 border-r border-slate-100 dark:border-zinc-800/80 space-y-6">
            {/* Student Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                <Icon name="person" size={14} />
                Student Info
              </h4>
              <div className="space-y-3.5 pl-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Target Grade</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
                    {selectedInquiry.classApplied?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Birth Date</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
                    {selectedInquiry.dateOfBirth
                      ? new Date(selectedInquiry.dateOfBirth).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gender</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
                    {selectedInquiry.gender}
                  </p>
                </div>
              </div>
            </div>

            {/* Parent Details */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                <Icon name="phone" size={14} />
                Parent Contacts
              </h4>
              <div className="space-y-3.5 pl-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Father / Guardian</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
                    {selectedInquiry.parentName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Contact Phone</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
                    {selectedInquiry.parentPhone}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email Address</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5 truncate">
                    {selectedInquiry.parentEmail}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Lead Source</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5 uppercase">
                    {selectedInquiry.source}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Follow-up Log & History */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Split Content: Form at top, History at bottom */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Follow-up Logging Form */}
              {selectedInquiry.status !== "APPLIED" ? (
                <form onSubmit={onSubmitFollowUp} className="p-4 rounded-2xl border border-sky-100 dark:border-sky-950/40 bg-sky-50/10 dark:bg-sky-950/[0.02] space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                    <Icon name="send" size={14} className="text-sky-500" />
                    Record Counselor Conversation Log
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status reached */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Follow-up Status
                      </label>
                      <Select
                        value={followUpForm.statusReached}
                        onValueChange={(val) => handleFieldChange("statusReached", val)}
                      >
                        <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INQUIRY">Logged Inquiry (New)</SelectItem>
                          <SelectItem value="CONTACTED">Contacted (Emailed/Called)</SelectItem>
                          <SelectItem value="VISITED">Visited (Campus Tour completed)</SelectItem>
                          <SelectItem value="CLOSED">Closed Lead (No response/Withdrawn)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Next Follow-up Date */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Next Action Reminder Date
                      </label>
                      <input
                        type="date"
                        value={followUpForm.nextFollowUpDate}
                        onChange={(e) => handleFieldChange("nextFollowUpDate", e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Conversation Summary Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={followUpForm.conversationNotes}
                      onChange={(e) => handleFieldChange("conversationNotes", e.target.value)}
                      placeholder="Log details on parent's decision timeline, query details..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300 resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="filled"
                      icon="save"
                      loading={loading}
                      className="bg-primary text-white hover:bg-primary/95 rounded-xl h-10 px-5 text-xs font-bold"
                    >
                      Save Follow-up Log
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 text-emerald-800 flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-emerald-600" />
                  <span className="text-xs font-bold">Inquiry has already been promoted to a full Application. No further counselor follow-up is required.</span>
                </div>
              )}

              {/* Follow-up Logs History */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="history" size={14} />
                  Counseling History Timeline
                </h4>

                {(!selectedInquiry.followUps || selectedInquiry.followUps.length === 0) ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl bg-slate-50/20">
                    No follow-ups logged yet.
                  </div>
                ) : (
                  <div className="relative border-l border-slate-100 pl-4 space-y-5 ml-2 mt-2">
                    {selectedInquiry.followUps.map((log) => (
                      <div key={log.id} className="relative group">
                        {/* Timeline dot */}
                        <span className="absolute -left-[21.5px] top-1.5 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-white shadow-sm" />
                        
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                          <span>
                            {new Date(log.followUpDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="text-primary font-bold uppercase tracking-wider">
                            Reached: {log.statusReached}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                          {log.conversationNotes}
                        </p>
                        {log.nextFollowUpDate && (
                          <div className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1.5">
                            <Icon name="event" size={12} />
                            <span>Next follow-up reminder: {new Date(log.nextFollowUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
