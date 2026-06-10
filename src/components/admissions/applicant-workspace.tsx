"use client";

import { useState } from "react";
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

interface Section {
  id: string;
  name: string;
}

interface InstallmentTemplate {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
}

interface CustomInstallment {
  templateId: string;
  amount: number;
  checked: boolean;
}

interface Application {
  id: string;
  applicationNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  status: "DRAFT" | "SUBMITTED" | "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED" | "ADMITTED" | "WITHDRAWN";
  class?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string } | null;
  documents?: { id: string; documentType: string; status: "PENDING" | "VERIFIED" | "REJECTED"; remarks: string | null }[] | null;
  examResult?: { id: string; examDate: string; marksObtained: number | null; maxMarks: number; verdict: string; notes: string | null } | null;
  fatherName: string | null;
  fatherPhone: string | null;
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;
  address: string;
  pincode: string;
  verificationNotes: string | null;
}

interface WorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApp: Application | null;
  statusLabels: Record<string, string>;
  hasEntranceTest: boolean;
  classSections: Section[];
  installmentTemplates: InstallmentTemplate[];
  customInstallments: CustomInstallment[];
  setCustomInstallments: (val: any) => void;
  promoteForm: {
    sectionId: string;
    rollNo: string;
    admissionDate: string;
    discountPercent: number;
    amountPaid: number;
    paymentMethod: "CASH" | "ONLINE" | "CHEQUE" | "BANK_TRANSFER" | "UPI";
    transactionId: string;
    termType: "FULL_TERM" | "HALF_TERM" | "SHORT_TERM";
  };
  setPromoteForm: (val: any) => void;
  verifyForm: {
    documents: DocumentItem[];
    verificationNotes: string;
    nextStatus: "DOCUMENT_VERIFICATION" | "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
  };
  setVerifyForm: (val: any) => void;
  examForm: {
    examDate: string;
    maxMarks: number;
    marksObtained: string;
    verdict: "PENDING" | "PASS" | "FAIL" | "BORDERLINE";
    notes: string;
    applicationStatus: "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
  };
  setExamForm: (val: any) => void;
  onVerifyDocs: (e: React.FormEvent) => void;
  onSaveExam: (e: React.FormEvent) => void;
  onPromote: (e: React.FormEvent) => void;
  actionLoading: boolean;
}

export default function ApplicantWorkspace({
  open,
  onOpenChange,
  selectedApp,
  statusLabels,
  hasEntranceTest,
  classSections,
  installmentTemplates,
  customInstallments,
  setCustomInstallments,
  promoteForm,
  setPromoteForm,
  verifyForm,
  setVerifyForm,
  examForm,
  setExamForm,
  onVerifyDocs,
  onSaveExam,
  onPromote,
  actionLoading,
}: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"general" | "parents">("general");

  if (!selectedApp) return null;

  // Doc verification change handlers
  const handleDocStatusChange = (index: number, status: "PENDING" | "VERIFIED" | "REJECTED") => {
    const nextDocs = [...verifyForm.documents];
    nextDocs[index] = { ...nextDocs[index], status };
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

  // Exam change handlers
  const handleExamChange = (field: string, value: any) => {
    setExamForm((prev: any) => {
      const next = { ...prev, [field]: value };
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

  // Promote change handlers
  const handlePromoteChange = (field: string, value: any) => {
    setPromoteForm((prev: any) => {
      const next = { ...prev, [field]: value };
      if (field === "discountPercent") {
        const discount = Number(value) || 0;
        setCustomInstallments((insts: CustomInstallment[]) =>
          insts.map((inst) => {
            const template = installmentTemplates.find((t) => t.id === inst.templateId);
            const baseAmount = template ? Number(template.amount) : 0;
            return {
              ...inst,
              amount: Math.max(0, Math.round(baseAmount * (1 - discount / 100))),
            };
          })
        );
      }
      return next;
    });
  };

  const handleInstallmentCheckChange = (index: number, checked: boolean) => {
    const nextInsts = [...customInstallments];
    nextInsts[index] = { ...nextInsts[index], checked };
    setCustomInstallments(nextInsts);
  };

  const handleInstallmentAmountChange = (index: number, amount: number) => {
    const nextInsts = [...customInstallments];
    nextInsts[index] = { ...nextInsts[index], amount };
    setCustomInstallments(nextInsts);
  };

  const baseTotal = installmentTemplates.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const activeInstallmentsTotal = customInstallments
    .filter((inst) => inst.checked)
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[88vh] overflow-hidden flex flex-col p-0 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/20 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary">
                {statusLabels[selectedApp.status] || selectedApp.status}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mx-1"></span>
              <span className="text-xs font-semibold text-slate-400">Application Number:</span>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300 border border-slate-200/40">
                {selectedApp.applicationNo}
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-slate-800 dark:text-zinc-100 mt-1.5">
              {selectedApp.firstName} {selectedApp.lastName}
            </DialogTitle>
          </div>
        </div>

        {/* Stepper Wizard Horizontal Path */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-around text-center shrink-0 overflow-x-auto select-none">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
            <span className="p-1 px-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border">1</span>
            <span>Submitted</span>
          </div>
          <div className="text-slate-300 dark:text-zinc-700">➔</div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span
              className={`p-1 px-2.5 rounded-full ${
                selectedApp.status !== "SUBMITTED"
                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border"
                  : "bg-primary text-white shadow-md shadow-primary/20"
              }`}
            >
              2
            </span>
            <span className={selectedApp.status === "DOCUMENT_VERIFICATION" ? "text-primary dark:text-sky-400 font-extrabold" : "text-slate-500"}>
              Document Verification
            </span>
          </div>
          {hasEntranceTest && (
            <>
              <div className="text-slate-300 dark:text-zinc-700">➔</div>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span
                  className={`p-1 px-2.5 rounded-full ${
                    selectedApp.status === "SHORTLISTED" || selectedApp.status === "ADMITTED"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border"
                      : selectedApp.status === "TEST_SCHEDULED"
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-600 border"
                  }`}
                >
                  3
                </span>
                <span className={selectedApp.status === "TEST_SCHEDULED" ? "text-primary dark:text-sky-400 font-extrabold" : "text-slate-500"}>
                  Entrance Test
                </span>
              </div>
            </>
          )}
          <div className="text-slate-300 dark:text-zinc-700">➔</div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span
              className={`p-1 px-2.5 rounded-full ${
                selectedApp.status === "ADMITTED"
                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border"
                  : selectedApp.status === "SHORTLISTED"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-600 border"
              }`}
            >
              {hasEntranceTest ? "4" : "3"}
            </span>
            <span className={selectedApp.status === "SHORTLISTED" ? "text-primary dark:text-sky-400 font-extrabold" : "text-slate-500"}>
              Shortlisted Selection
            </span>
          </div>
          <div className="text-slate-300 dark:text-zinc-700">➔</div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span
              className={`p-1 px-2.5 rounded-full ${
                selectedApp.status === "ADMITTED" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "bg-slate-50 dark:bg-zinc-850 text-slate-400 dark:text-zinc-600 border"
              }`}
            >
              {hasEntranceTest ? "5" : "4"}
            </span>
            <span className={selectedApp.status === "ADMITTED" ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-slate-500"}>
              Enrolled (SIS)
            </span>
          </div>
        </div>

        {/* Main Split Body Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* A. Left Pane: Candidate Summary Profile */}
          <div className="w-[38%] overflow-y-auto p-6 bg-slate-50/50 dark:bg-zinc-950/10 border-r border-slate-100 dark:border-zinc-800/80 space-y-6">
            {/* Tab toggles */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-zinc-900 border rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab("general")}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-colors ${
                  activeTab === "general"
                    ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Profile Info
              </button>
              <button
                onClick={() => setActiveTab("parents")}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-colors ${
                  activeTab === "parents"
                    ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Family Info
              </button>
            </div>

            {activeTab === "general" ? (
              <div className="space-y-6">
                {/* Application details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <Icon name="assignment" size={14} />
                    Application Details
                  </h3>
                  <div className="space-y-3.5 pl-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Target Class</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.class?.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Academic Year</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.academicYear?.name || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Personal details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <Icon name="person" size={14} />
                    Personal Details
                  </h3>
                  <div className="space-y-3.5 pl-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Birth Date</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
                        {new Date(selectedApp.dateOfBirth).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gender</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.gender}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Residence Address</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5 leading-relaxed">
                        {selectedApp.address}, {selectedApp.pincode}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Father profile */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <Icon name="person" size={14} />
                    Father's Details
                  </h3>
                  <div className="space-y-3.5 pl-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Father's Name</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.fatherName || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone Number</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.fatherPhone || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email Address</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5 truncate">{selectedApp.fatherEmail || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Occupation</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.fatherOccupation || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Mother profile */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-pink-500 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <Icon name="person" size={14} className="text-pink-500" />
                    Mother's Details
                  </h3>
                  <div className="space-y-3.5 pl-1">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Mother's Name</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.motherName || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone Number</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.motherPhone || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Occupation</span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.motherOccupation || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* B. Right Pane: Process Actions Desk (Dynamic Stage Wizards) */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* WIZARD: DOCUMENT CHECK (Submitted or Document Verification stages) */}
            {(selectedApp.status === "SUBMITTED" || selectedApp.status === "DOCUMENT_VERIFICATION") && (
              <form onSubmit={onVerifyDocs} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                    <Icon name="check_circle" size={16} className="text-amber-500" />
                    Document Checklist Review
                  </h3>

                  {verifyForm.documents.length === 0 ? (
                    <div className="p-6 text-center border border-dashed rounded-2xl text-slate-400 bg-slate-50/50">
                      <Icon name="upload" size={24} className="opacity-40 mb-1" />
                      <p className="text-xs font-bold">No documents uploaded by applicant.</p>
                      <p className="text-[10px] opacity-60 mt-0.5">Please add internal notes and proceed with Selection or Rejection.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {verifyForm.documents.map((doc, index) => (
                        <div
                          key={doc.id}
                          className="p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/10 dark:bg-zinc-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="p-2 rounded-xl bg-white dark:bg-zinc-900 border text-slate-500 dark:text-zinc-400">
                              <Icon name="menu_book" size={14} />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
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

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              placeholder="Remarks..."
                              value={doc.remarks}
                              onChange={(e) => handleDocRemarksChange(index, e.target.value)}
                              className="w-40 h-8 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all"
                            />

                            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-zinc-900 rounded-xl border">
                              <button
                                type="button"
                                onClick={() => handleDocStatusChange(index, "VERIFIED")}
                                className={`p-1 px-2 rounded-lg text-[10px] font-bold flex items-center gap-0.5 ${
                                  doc.status === "VERIFIED" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDocStatusChange(index, "REJECTED")}
                                className={`p-1 px-2 rounded-lg text-[10px] font-bold flex items-center gap-0.5 ${
                                  doc.status === "REJECTED" ? "bg-red-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 px-0.5 select-none">
                    Clerk Review Verification Notes
                  </span>
                  <textarea
                    rows={2}
                    value={verifyForm.verificationNotes}
                    onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, verificationNotes: e.target.value }))}
                    placeholder="Record mismatches or requests for re-upload..."
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all resize-none"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-primary/10 bg-primary/[0.02] dark:bg-sky-500/[0.01] space-y-3.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Next Stage Transition
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      value={verifyForm.nextStatus}
                      onValueChange={(val: any) => setVerifyForm((prev: any) => ({ ...prev, nextStatus: val }))}
                    >
                      <SelectTrigger fullWidth className="h-10 rounded-xl border-slate-200 dark:border-zinc-800 text-xs font-bold bg-white dark:bg-zinc-900">
                        <SelectValue placeholder="Select Next Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOCUMENT_VERIFICATION">Keep at Doc Verification (Hold)</SelectItem>
                        {hasEntranceTest && <SelectItem value="TEST_SCHEDULED">Entrance Exam desk (Approved)</SelectItem>}
                        <SelectItem value="SHORTLISTED">Direct Shortlist (Ready to Promote)</SelectItem>
                        <SelectItem value="REJECTED">Reject Applicant</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center pl-1 font-semibold">
                      <span>
                        {verifyForm.nextStatus === "TEST_SCHEDULED"
                          ? "✨ Promotes candidate to Entrance Exam scheduling."
                          : verifyForm.nextStatus === "SHORTLISTED"
                          ? "✨ Shortlists candidate for Registrar promotion."
                          : verifyForm.nextStatus === "REJECTED"
                          ? "⚠️ Moves candidate to archives as Rejected."
                          : "✨ Holds candidate at Verification Stage."}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="filled"
                    icon="save"
                    loading={actionLoading}
                    className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/15"
                  >
                    Save Verification Details
                  </Button>
                </div>
              </form>
            )}

            {/* WIZARD: ENTRANCE TEST */}
            {selectedApp.status === "TEST_SCHEDULED" && (
              <form onSubmit={onSaveExam} className="space-y-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                  <Icon name="event" size={16} className="text-purple-500" />
                  Entrance Exam Scoring Card
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {/* Test Date */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Test Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={examForm.examDate}
                      onChange={(e) => handleExamChange("examDate", e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>

                  {/* Maximum Marks */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Maximum Marks <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={String(examForm.maxMarks)}
                      onChange={(e) => handleExamChange("maxMarks", e.target.value)}
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
                      onChange={(e) => handleExamChange("marksObtained", e.target.value)}
                      placeholder="Leave blank if pending"
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Verdict Grid */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Evaluation Verdict
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: "PASS", name: "Pass", icon: "check_circle", activeBg: "bg-emerald-600 text-white shadow-md shadow-emerald-600/10", borderClass: "border-emerald-100 text-emerald-700 bg-emerald-50/10 hover:bg-emerald-50/30" },
                      { id: "FAIL", name: "Fail", icon: "cancel", activeBg: "bg-red-500 text-white shadow-md shadow-red-500/10", borderClass: "border-red-100 text-red-700 bg-red-50/10 hover:bg-red-50/30" },
                      { id: "BORDERLINE", name: "Borderline", icon: "warning", activeBg: "bg-amber-500 text-white shadow-md shadow-amber-500/10", borderClass: "border-amber-100 text-amber-700 bg-amber-50/10 hover:bg-amber-50/30" },
                      { id: "PENDING", name: "Pending", icon: "lock_reset", activeBg: "bg-slate-500 text-white shadow-md shadow-slate-500/10", borderClass: "border-slate-100 text-slate-600 bg-slate-50/10 hover:bg-slate-50/30" }
                    ].map((v) => {
                      const isActive = examForm.verdict === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleExamChange("verdict", v.id)}
                          className={`p-3 border rounded-2xl flex flex-col items-center justify-center text-center gap-1 font-bold text-[11px] transition-all duration-300 ${
                            isActive ? v.activeBg : v.borderClass
                          }`}
                        >
                          <Icon name={v.icon} size={16} className={isActive ? "text-white" : ""} />
                          <span>{v.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 px-0.5 select-none">
                    Evaluator Comments
                  </span>
                  <textarea
                    rows={2}
                    value={examForm.notes}
                    onChange={(e) => handleExamChange("notes", e.target.value)}
                    placeholder="Record interview notes, behavior observations..."
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all resize-none"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-primary/10 bg-primary/[0.02] dark:bg-sky-500/[0.01] space-y-3.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Next Stage Transition
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      value={examForm.applicationStatus}
                      onValueChange={(val: any) => handleExamChange("applicationStatus", val)}
                    >
                      <SelectTrigger fullWidth className="h-10 rounded-xl border-slate-200 dark:border-zinc-800 text-xs font-bold bg-white dark:bg-zinc-900">
                        <SelectValue placeholder="Select Next Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEST_SCHEDULED">Keep at Entrance Exam (Pending)</SelectItem>
                        <SelectItem value="SHORTLISTED">Promote to Shortlisted Desk (Passed)</SelectItem>
                        <SelectItem value="REJECTED">Move to Rejected Archives (Failed)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center pl-1 font-semibold">
                      <span>
                        {examForm.applicationStatus === "SHORTLISTED"
                          ? "✨ Promotes candidate to final Registrar Desk selection."
                          : examForm.applicationStatus === "REJECTED"
                          ? "⚠️ Moves candidate to archives as Rejected."
                          : "✨ Holds candidate under exam evaluations."}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="filled"
                    icon="save"
                    loading={actionLoading}
                    className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/15"
                  >
                    Save Exam Scorecard
                  </Button>
                </div>
              </form>
            )}

            {/* WIZARD: PROMOTION (SHORTLISTED) */}
            {selectedApp.status === "SHORTLISTED" && (
              <form onSubmit={onPromote} className="space-y-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                  <Icon name="school" size={16} className="text-teal-500" />
                  SIS Promotion & Setup
                </h3>

                {/* Placement info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Section Select */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Class Division (Section) <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={promoteForm.sectionId}
                      onValueChange={(val) => handlePromoteChange("sectionId", val)}
                    >
                      <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            Section {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Roll No */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Roll Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={promoteForm.rollNo}
                      onChange={(e) => handlePromoteChange("rollNo", e.target.value)}
                      placeholder="e.g. 101"
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>

                  {/* Admission Date */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Admission Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={promoteForm.admissionDate}
                      onChange={(e) => handlePromoteChange("admissionDate", e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Fee Allocations */}
                <div className="p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                      <Icon name="receipt_long" size={14} className="text-amber-500" />
                      Fee Installments List
                    </h4>
                    <select
                      value={promoteForm.termType}
                      onChange={(e) => handlePromoteChange("termType", e.target.value)}
                      className="text-xs font-extrabold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-lg p-1.5 text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="FULL_TERM">Full Term</option>
                      <option value="HALF_TERM">Half Term</option>
                      <option value="SHORT_TERM">Short Term</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Scholarship / Discount (%)
                      </label>
                      <input
                        type="number"
                        value={String(promoteForm.discountPercent)}
                        onChange={(e) => handlePromoteChange("discountPercent", e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Base Dues
                      </label>
                      <div className="flex items-center justify-center h-12 rounded-xl bg-slate-100/50 dark:bg-zinc-950/40 border border-slate-200/60 dark:border-zinc-800/80 text-sm font-extrabold text-slate-700 dark:text-zinc-300 select-none">
                        ₹{baseTotal}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Onboarding Total
                      </label>
                      <div className="flex items-center justify-center h-12 rounded-xl bg-primary/5 dark:bg-sky-500/[0.03] border border-primary/20 dark:border-sky-500/20 text-sm font-black text-primary dark:text-sky-400 select-none">
                        ₹{activeInstallmentsTotal}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {installmentTemplates.map((t, index) => {
                      const inst = customInstallments.find((ci) => ci.templateId === t.id) || { checked: false, amount: 0 };
                      return (
                        <div
                          key={t.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-4 transition-colors ${
                            inst.checked ? "bg-white dark:bg-zinc-900 border-primary/20" : "bg-slate-100/40 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={inst.checked}
                              onChange={(e) => handleInstallmentCheckChange(index, e.target.checked)}
                              className="rounded text-primary focus:ring-primary w-4 h-4"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{t.name}</span>
                              <span className="text-[9px] text-slate-400 block">
                                Due: {new Date(t.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              disabled={!inst.checked}
                              value={String(inst.amount)}
                              onChange={(e) => handleInstallmentAmountChange(index, Number(e.target.value) || 0)}
                              className="w-20 h-7 text-xs font-bold bg-slate-50 dark:bg-zinc-900 border rounded p-1 text-right text-slate-800 dark:text-zinc-200 outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                    <Icon name="payments" size={14} className="text-emerald-500" />
                    3. Process Admission Payment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* Amount Paid Now */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Amount Paid Now
                      </label>
                      <input
                        type="number"
                        value={String(promoteForm.amountPaid)}
                        onChange={(e) => handlePromoteChange("amountPaid", e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Payment Method
                      </label>
                      <Select
                        value={promoteForm.paymentMethod}
                        onValueChange={(val: any) => handlePromoteChange("paymentMethod", val)}
                      >
                        <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                          <SelectValue placeholder="Select Method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash Payment</SelectItem>
                          <SelectItem value="UPI">UPI Transfer</SelectItem>
                          <SelectItem value="ONLINE">Online Portal</SelectItem>
                          <SelectItem value="CHEQUE">Bank Cheque</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Transaction ID */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Transaction ID
                      </label>
                      <input
                        type="text"
                        value={promoteForm.transactionId}
                        onChange={(e) => handlePromoteChange("transactionId", e.target.value)}
                        placeholder="e.g. TXN987654"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="filled"
                    icon="school"
                    loading={actionLoading}
                    className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/15"
                  >
                    Promote Candidate to Student
                  </Button>
                </div>
              </form>
            )}

            {/* STATUS: ADMITTED / ENROLLED (Success State) */}
            {selectedApp.status === "ADMITTED" && (
              <div className="py-10 text-center space-y-6">
                <span className="inline-flex items-center justify-center p-5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 shadow-sm animate-pulse">
                  <Icon name="check_circle" size={48} />
                </span>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                    Candidate Enrolled Successfully!
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Student profile has been initialized in the Student Information System (SIS). They can now log in, receive daily attendance records, and generate financial ledgers.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <DialogClose asChild>
                    <Button variant="outlined" className="rounded-xl h-11 px-5">
                      Dismiss
                    </Button>
                  </DialogClose>
                </div>
              </div>
            )}

            {/* STATUS: REJECTED */}
            {selectedApp.status === "REJECTED" && (
              <div className="py-10 text-center space-y-6">
                <span className="inline-flex items-center justify-center p-5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 border border-red-100 shadow-sm">
                  <Icon name="cancel" size={48} />
                </span>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                    Candidate Rejected
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    This applicant did not pass evaluation parameters or document checks. They are stored in the admissions archives logs.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <DialogClose asChild>
                    <Button variant="outlined" className="rounded-xl h-11 px-5">
                      Dismiss
                    </Button>
                  </DialogClose>
                </div>
              </div>
            )}

            {/* STATUS: WITHDRAWN */}
            {selectedApp.status === "WITHDRAWN" && (
              <div className="py-10 text-center space-y-6">
                <span className="inline-flex items-center justify-center p-5 rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm">
                  <Icon name="person_off" size={48} />
                </span>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                    Application Withdrawn
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    The parent/candidate withdrew the admission inquiry. Stored in archives list.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <DialogClose asChild>
                    <Button variant="outlined" className="rounded-xl h-11 px-5">
                      Dismiss
                    </Button>
                  </DialogClose>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
