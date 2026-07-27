"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CurrencyInput } from "@/components/ui/currency-input";
import { BaseCurrencyInput } from "@/components/ui/base-currency-input";
import { formatIndianNumber } from "@/lib/utils-format";

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
  lateFeeActive?: boolean;
  lateFeeType?: "DAILY" | "FIXED" | "PERCENTAGE";
  lateFeeValue?: number;
  lateFeePerDay?: number;
  lateFeeGrace?: number;
}

interface CustomInstallment {
  id: string;
  templateId?: string;
  name: string;
  dueDate: string;
  amount: number;
  checked: boolean;
  isCustom: boolean;
  lateFeeActive?: boolean;
  lateFeeType?: "DAILY" | "FIXED" | "PERCENTAGE";
  lateFeeValue?: number;
  lateFeePerDay?: number;
  lateFeeGrace?: number;
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
  archiveReason?: string | null;
  statusBeforeArchive?: string | null;
}

interface WorkspaceProps {
  onClose: () => void;
  selectedApp: Application | null;
  statusLabels: Record<string, string>;
  classes?: any[];
  onApplicantUpdated?: (updatedApp: any) => void;
  hasEntranceTest: boolean;
  classSections: Section[];
  installmentTemplates: InstallmentTemplate[];
  customInstallments: CustomInstallment[];
  setCustomInstallments: (val: any) => void;
  billingMode: "STANDARD" | "CUSTOM";
  setBillingMode: (val: "STANDARD" | "CUSTOM") => void;
  customConfigRows: number;
  setCustomConfigRows: (val: number) => void;
  customConfigStartDate: string;
  setCustomConfigStartDate: (val: string) => void;
  customConfigInterval: "MONTHLY" | "BIMONTHLY" | "QUARTERLY";
  setCustomConfigInterval: (val: "MONTHLY" | "BIMONTHLY" | "QUARTERLY") => void;
  customConfigLateFee: boolean;
  setCustomConfigLateFee: (val: boolean) => void;
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
    archiveReason: string;
  };
  setVerifyForm: (val: any) => void;
  examForm: {
    examDate: string;
    maxMarks: number;
    marksObtained: string;
    verdict: "PENDING" | "PASS" | "FAIL" | "BORDERLINE";
    notes: string;
    applicationStatus: "TEST_SCHEDULED" | "SHORTLISTED" | "REJECTED";
    archiveReason: string;
  };
  setExamForm: (val: any) => void;
  onVerifyDocs: (e: React.FormEvent) => void;
  onSaveExam: (e: React.FormEvent) => void;
  onPromote: (e: React.FormEvent) => void;
  onWithdrawApplicant?: (reason: string) => Promise<boolean>;
  onReactivateApplicant?: () => Promise<void>;
  actionLoading: boolean;
  formError: string | null;
  setFormError?: (err: string | null) => void;
  classFees?: any[];
  selectedOptionalFees?: { id: string; amount: number }[];
  setSelectedOptionalFees?: (val: any) => void;
}

export default function ApplicantWorkspace({
  onClose,
  selectedApp,
  statusLabels,
  classes = [],
  onApplicantUpdated,
  hasEntranceTest,
  classSections,
  installmentTemplates,
  customInstallments,
  setCustomInstallments,
  billingMode,
  setBillingMode,
  customConfigRows,
  setCustomConfigRows,
  customConfigStartDate,
  setCustomConfigStartDate,
  customConfigInterval,
  setCustomConfigInterval,
  customConfigLateFee,
  setCustomConfigLateFee,
  promoteForm,
  setPromoteForm,
  verifyForm,
  setVerifyForm,
  examForm,
  setExamForm,
  onVerifyDocs,
  onSaveExam,
  onPromote,
  onWithdrawApplicant,
  onReactivateApplicant,
  actionLoading,
  formError,
  setFormError,
  classFees = [],
  selectedOptionalFees = [],
  setSelectedOptionalFees,
}: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"general" | "parents" | "docs">("general");
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<any>(selectedApp);

  useEffect(() => {
    setEditForm(selectedApp);
    setIsEditing(false);
  }, [selectedApp]);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const mandatoryTotal = classFees.length > 0
    ? classFees.filter(f => f.applicability === "MANDATORY").reduce((acc, curr) => {
        const mult = curr.frequency === "MONTHLY" ? 12 : curr.frequency === "QUARTERLY" ? 4 : curr.frequency === "SEMI_ANNUAL" ? 2 : 1;
        return acc + Number(curr.amount) * mult;
      }, 0)
    : (installmentTemplates || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

  const optionalTotal = selectedOptionalFees.reduce((acc: any, curr: any) => {
    const classFee = classFees.find(f => f.id === curr.id);
    const mult = classFee ? (classFee.frequency === "MONTHLY" ? 12 : classFee.frequency === "QUARTERLY" ? 4 : classFee.frequency === "SEMI_ANNUAL" ? 2 : 1) : 1;
    return acc + Number(curr.amount) * mult;
  }, 0);

  const baseTotal = mandatoryTotal + optionalTotal;
  const totalDiscountedFee = Math.max(0, Math.round(mandatoryTotal * (1 - (promoteForm.discountPercent || 0) / 100))) + optionalTotal;

  // Auto-distribute totalDiscountedFee when it changes (due to optional fees or discount)
  useEffect(() => {
    if (customInstallments && customInstallments.length > 0) {
      setCustomInstallments((prev: any[]) => {
        const checkedInsts = prev.filter(i => i.checked);
        if (checkedInsts.length === 0) return prev;
        
        let remaining = totalDiscountedFee;
        const newInsts = prev.map((inst) => {
          if (!inst.checked) return { ...inst, amount: 0 };
          const isLast = inst.id === checkedInsts[checkedInsts.length - 1].id;
          let rowAmount = 0;
          
          if (isLast) {
            rowAmount = remaining;
          } else {
            rowAmount = Math.round(totalDiscountedFee / checkedInsts.length);
            remaining -= rowAmount;
          }
          
          return { ...inst, amount: rowAmount };
        });
        
        // Deep compare to prevent unnecessary state updates
        const isDifferent = newInsts.some((inst, i) => inst.amount !== prev[i].amount);
        return isDifferent ? newInsts : prev;
      });
    }
  }, [totalDiscountedFee, customInstallments.length, setCustomInstallments]);

  if (!selectedApp) return null;

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onWithdrawApplicant || !withdrawReason.trim()) return;
    setWithdrawLoading(true);
    const success = await onWithdrawApplicant(withdrawReason);
    setWithdrawLoading(false);
    if (success) {
      setWithdrawDialogOpen(false);
      setWithdrawReason("");
    }
  };

  const handleReactivateSubmit = async () => {
    if (!onReactivateApplicant) return;
    setReactivateLoading(true);
    await onReactivateApplicant();
    setReactivateLoading(false);
  };

  const clearError = () => {
    if (formError) {
      setFormError?.(null);
    }
  };

  // Doc verification change handlers
  const handleDocStatusChange = (index: number, status: "PENDING" | "VERIFIED" | "REJECTED") => {
    clearError();
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
    clearError();
    const nextDocs = [...verifyForm.documents];
    nextDocs[index] = { ...nextDocs[index], remarks };
    setVerifyForm((prev: any) => ({ ...prev, documents: nextDocs }));
  };

  // Exam change handlers
  const handleExamChange = (field: string, value: any) => {
    clearError();
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
    clearError();
    setPromoteForm((prev: any) => {
      const next = { ...prev, [field]: value };
      if (field === "discountPercent") {
        const discount = Number(value) || 0;
        setCustomInstallments((insts: CustomInstallment[]) =>
          insts.map((inst) => {
            const template = installmentTemplates.find((t) => t.id === inst.templateId);
            if (template) {
              const baseAmount = Number(template.amount) || 0;
              return {
                ...inst,
                amount: Math.max(0, Math.round(baseAmount * (1 - discount / 100))),
              };
            }
            return inst;
          })
        );
      }
      return next;
    });
  };

  const handleInstallmentAmountChange = (templateId: string, amount: number) => {
    clearError();
    setCustomInstallments((prev: CustomInstallment[]) =>
      prev.map((inst) => (inst.templateId === templateId ? { ...inst, amount } : inst))
    );
  };

  const handleInstallmentCheckChange = (templateId: string, checked: boolean) => {
    clearError();
    setCustomInstallments((prev: CustomInstallment[]) =>
      prev.map((inst) => (inst.templateId === templateId ? { ...inst, checked } : inst))
    );
  };

  // Add-ons Handlers
  const handleOptionalFeeToggle = (fee: any, checked: boolean) => {
    if (checked) {
      setSelectedOptionalFees?.((prev: any) => [...prev, { id: fee.id, amount: fee.amount }]);
    } else {
      setSelectedOptionalFees?.((prev: any) => prev.filter((f: any) => f.id !== fee.id));
    }
  };

  const handleOptionalFeeAmountChange = (feeId: string, newAmount: number) => {
    setSelectedOptionalFees?.((prev: any) => prev.map((f: any) => f.id === feeId ? { ...f, amount: newAmount } : f));
  };

  // God-Level Custom Installments Generator
  const generateCustomInstallments = () => {
    if (customConfigRows <= 0) return;

    // Helper: Safely add months to a date without overflowing (e.g. Jan 31 -> Feb 28)
    const addMonths = (dateStr: string, months: number) => {
      const d = new Date(dateStr);
      const day = d.getDate();
      d.setMonth(d.getMonth() + months);
      if (d.getDate() !== day) {
        d.setDate(0); // If day overflowed, set to last day of previous month
      }
      return d;
    };

    // Extract default late fee settings from standard templates if available
    const defaultTemplate = installmentTemplates[0];
    const lateFeeType = defaultTemplate?.lateFeeType || "DAILY";
    const lateFeeValue = Number(defaultTemplate?.lateFeeValue) || 0;
    const lateFeePerDay = Number(defaultTemplate?.lateFeePerDay) || 0;
    const lateFeeGrace = Number(defaultTemplate?.lateFeeGrace) || 0;

    const newInsts: CustomInstallment[] = [];
    let remainingAmount = totalDiscountedFee;
    let currentDateStr = customConfigStartDate;

    for (let i = 0; i < customConfigRows; i++) {
      // Penny Drop Algorithm
      let rowAmount = 0;
      if (i === customConfigRows - 1) {
        rowAmount = remainingAmount; // Last row takes all remaining to ensure perfect match
      } else {
        rowAmount = Math.round(totalDiscountedFee / customConfigRows);
        remainingAmount -= rowAmount;
      }

      newInsts.push({
        id: `custom-${Date.now()}-${i}`,
        name: `Installment ${i + 1}`,
        dueDate: currentDateStr + "T00:00:00.000Z",
        amount: rowAmount,
        checked: true,
        isCustom: true,
        lateFeeActive: customConfigLateFee,
        lateFeeType,
        lateFeeValue,
        lateFeePerDay,
        lateFeeGrace,
      });

      // Calculate next due date
      const intervalMonths = customConfigInterval === "MONTHLY" ? 1 : customConfigInterval === "BIMONTHLY" ? 2 : 3;
      const nextDate = addMonths(currentDateStr, intervalMonths);
      currentDateStr = nextDate.toISOString().split("T")[0];
    }

    setCustomInstallments(newInsts);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onApplicantUpdated || !selectedApp) return;
    
    setEditLoading(true);
    try {
      const response = await fetch(`/api/v1/admissions/applications/${selectedApp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error("Failed to update application");
      }

      const updated = await response.json();
      onApplicantUpdated(updated.data);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating application:", error);
      alert("Failed to update application details.");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden mb-8 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2.5 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-full transition-colors text-slate-600 dark:text-zinc-300 shadow-sm"
          >
            <Icon name="arrow_back" size={20} />
          </button>
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
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 mt-1.5">
              {selectedApp.firstName} {selectedApp.lastName}
            </h2>
          </div>
        </div>
          {selectedApp.status !== "ADMITTED" && selectedApp.status !== "REJECTED" && selectedApp.status !== "WITHDRAWN" && onWithdrawApplicant && (
            <Button
              type="button"
              variant="outlined"
              icon="person_off"
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:border-rose-300 rounded-xl h-10 px-4 text-xs font-bold shrink-0 transition-all duration-300 cursor-pointer"
              onClick={() => setWithdrawDialogOpen(true)}
            >
              Withdraw Application
            </Button>
          )}
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
          <div className="w-[26%] min-w-[280px] max-w-[320px] overflow-y-auto p-6 bg-slate-50/50 dark:bg-zinc-950/20 border-r border-slate-200/60 dark:border-zinc-800/80 space-y-6">
            {/* Tab toggles & Edit Action */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 border rounded-xl shrink-0 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("general")}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-colors ${
                    activeTab === "general"
                      ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("parents")}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-colors ${
                    activeTab === "parents"
                      ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Family
                </button>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-500 hover:text-primary transition-colors shrink-0"
                  title="Edit Profile Information"
                >
                  <Icon name="edit" size={16} />
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="space-y-6">
                {activeTab === "general" ? (
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                      <Icon name="assignment" size={14} /> Application Details
                    </h3>
                    <div className="space-y-3 pl-1">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Target Class</label>
                        <Select
                          value={editForm.classId}
                          onValueChange={(val) => setEditForm((p: any) => ({ ...p, classId: val }))}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold bg-white dark:bg-zinc-950 mt-1">
                            <SelectValue placeholder="Select Class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((cls) => (
                              <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">First Name</label>
                          <input required value={editForm.firstName || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, firstName: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Last Name</label>
                          <input required value={editForm.lastName || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, lastName: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Birth Date</label>
                        <input required type="date" value={editForm.dateOfBirth ? new Date(editForm.dateOfBirth).toISOString().split('T')[0] : ''} onChange={(e) => setEditForm((p: any) => ({ ...p, dateOfBirth: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Gender</label>
                          <Select value={editForm.gender} onValueChange={(val) => setEditForm((p: any) => ({ ...p, gender: val }))}>
                            <SelectTrigger className="h-8 text-xs font-semibold bg-white dark:bg-zinc-950 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Blood Group</label>
                          <input value={editForm.bloodGroup || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, bloodGroup: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Previous School</label>
                        <input value={editForm.previousSchool || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, previousSchool: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Emergency Contact</label>
                        <input value={editForm.emergencyContact || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, emergencyContact: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Address</label>
                          <input required value={editForm.address || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, address: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pincode</label>
                          <input required value={editForm.pincode || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, pincode: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-xs font-extrabold text-primary dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                        <Icon name="person" size={14} /> Father's Details
                      </h3>
                      <div className="space-y-3 pl-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Name</label>
                          <input value={editForm.fatherName || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, fatherName: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone</label>
                            <input value={editForm.fatherPhone || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, fatherPhone: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email</label>
                            <input type="email" value={editForm.fatherEmail || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, fatherEmail: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Occupation</label>
                          <input value={editForm.fatherOccupation || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, fatherOccupation: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-extrabold text-pink-500 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
                        <Icon name="person" size={14} className="text-pink-500" /> Mother's Details
                      </h3>
                      <div className="space-y-3 pl-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Name</label>
                          <input value={editForm.motherName || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, motherName: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone</label>
                            <input value={editForm.motherPhone || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, motherPhone: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email</label>
                            <input type="email" value={editForm.motherEmail || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, motherEmail: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Occupation</label>
                          <input value={editForm.motherOccupation || ''} onChange={(e) => setEditForm((p: any) => ({ ...p, motherOccupation: e.target.value }))} className="w-full h-8 px-2 text-xs rounded-lg border mt-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2 sticky bottom-0 bg-slate-50/90 dark:bg-zinc-950/90 py-2 backdrop-blur-sm z-10">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={editLoading}>Cancel</Button>
                  <Button type="submit" variant="primary" size="sm" loading={editLoading}>Save Changes</Button>
                </div>
              </form>
            ) : (
              // READ ONLY VIEW
              activeTab === "general" ? (
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
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Previous School</span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.previousSchool || "—"}</p>
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
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Full Name</span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.firstName} {selectedApp.lastName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
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
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Blood Group</span>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.bloodGroup || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Emergency Phone</span>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.emergencyContact || "—"}</p>
                        </div>
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone</span>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.fatherPhone || "—"}</p>
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email</span>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5 truncate">{selectedApp.fatherEmail || "—"}</p>
                        </div>
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone</span>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.motherPhone || "—"}</p>
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email</span>
                          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5 truncate">{selectedApp.motherEmail || "—"}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Occupation</span>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{selectedApp.motherOccupation || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* B. Right Pane: Process Actions Desk (Dynamic Stage Wizards) */}
          <div className="w-[74%] flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/10 dark:bg-zinc-900/10">
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
                  {verifyForm.nextStatus === "REJECTED" && (
                    <div className="flex flex-col gap-1.5 mt-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Rejection Reason <span className="text-red-500">*</span>
                      </span>
                      <textarea
                        rows={2}
                        required
                        value={verifyForm.archiveReason || ""}
                        onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, archiveReason: e.target.value }))}
                        placeholder="Specify why the applicant is being rejected..."
                        className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all resize-none font-semibold"
                      />
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="p-4 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/10 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5">
                    <Icon name="warning" size={16} className="text-red-500 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="filled"
                    icon="check"
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
                  {(examForm.applicationStatus === "REJECTED" || examForm.verdict === "FAIL") && (
                    <div className="flex flex-col gap-1.5 mt-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Rejection Reason <span className="text-red-500">*</span>
                      </span>
                      <textarea
                        rows={2}
                        required
                        value={examForm.archiveReason || ""}
                        onChange={(e) => handleExamChange("archiveReason", e.target.value)}
                        placeholder="Specify why the applicant is being rejected..."
                        className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all resize-none font-semibold"
                      />
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="p-4 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/10 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5">
                    <Icon name="warning" size={16} className="text-red-500 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="filled"
                    icon="check"
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
              <form onSubmit={onPromote} className="space-y-7 pr-1">
                
                {/* 1. Academic Placement Card */}
                <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/85 shadow-md shadow-slate-100/50 dark:shadow-none space-y-5 transition-all duration-300 hover:shadow-lg">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                      <Icon name="assignment" size={14} />
                    </span>
                    <span className="font-extrabold uppercase tracking-wider text-[11px]">Academic Placement Settings</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Section Select */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Class Division (Section) <span className="text-red-500">*</span>
                      </span>
                      <Select
                        value={promoteForm.sectionId}
                        onValueChange={(val) => handlePromoteChange("sectionId", val)}
                      >
                        <SelectTrigger fullWidth className="h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:ring-4 focus:ring-primary/10 transition-all duration-300">
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
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Roll Number (Optional)
                      </span>
                      <input
                        type="text"
                        value={promoteForm.rollNo}
                        onChange={(e) => handlePromoteChange("rollNo", e.target.value)}
                        placeholder="e.g. 101"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300"
                      />
                    </div>

                    {/* Admission Date */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Admission Date <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="date"
                        required
                        value={promoteForm.admissionDate}
                        onChange={(e) => handlePromoteChange("admissionDate", e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Billing & Installments Side-by-Side Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
                  
                  {/* Left: Billing Controls Card (5 cols) */}
                  {/* Left: Billing Controls Card (5 cols) - LIVE RECEIPT STYLE */}
                  <div className="lg:col-span-5 flex flex-col relative">
                    <div className="relative bg-amber-50/40 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800 shadow-lg shadow-slate-200/40 dark:shadow-none pb-4 transition-all duration-300">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"></div>
                      
                      <div className="p-6 pt-8 space-y-6">
                        <div className="text-center pb-4 border-b-2 border-dashed border-slate-200 dark:border-zinc-700">
                          <h4 className="font-black uppercase tracking-widest text-slate-800 dark:text-zinc-100 text-sm">
                            Fee Receipt
                          </h4>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Live Estimate</p>
                        </div>

                        {/* Billing Mode Toggle */}
                        <div className="flex p-1 bg-slate-200/50 dark:bg-zinc-950/50 rounded-lg shadow-inner">
                          <button
                            type="button"
                            onClick={() => {
                              setBillingMode("STANDARD");
                              if (installmentTemplates && installmentTemplates.length > 0) {
                                setCustomInstallments(
                                  installmentTemplates.map((t: any) => ({
                                    id: `template-${t.id}`,
                                    templateId: t.id,
                                    name: t.name,
                                    dueDate: t.dueDate,
                                    amount: Math.round(Number(t.amount) * (1 - (promoteForm.discountPercent || 0) / 100)),
                                    checked: true,
                                    isCustom: false,
                                  }))
                                );
                              }
                            }}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                              billingMode === "STANDARD"
                                ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm border border-slate-200/50 dark:border-zinc-700"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
                            }`}
                          >
                            Standard
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBillingMode("CUSTOM");
                              setCustomInstallments([]);
                            }}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                              billingMode === "CUSTOM"
                                ? "bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm border border-slate-200/50 dark:border-zinc-700"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
                            }`}
                          >
                            Custom
                          </button>
                        </div>

                        {billingMode === "STANDARD" ? (
                          /* Term Selection */
                          <div className="flex flex-col gap-1.5 w-full">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                              Billing Term / Intake Type
                            </span>
                            <Select
                              value={promoteForm.termType}
                              onValueChange={(val: any) => handlePromoteChange("termType", val)}
                            >
                              <SelectTrigger fullWidth className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-slate-800 dark:text-zinc-200 focus:ring-4 focus:ring-primary/10 transition-all duration-300">
                                <SelectValue placeholder="Select Term" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FULL_TERM">Full Term</SelectItem>
                                <SelectItem value="HALF_TERM">Half Term</SelectItem>
                                <SelectItem value="SHORT_TERM">Short Term</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          /* Custom Generator Wizard */
                          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Installments</span>
                                <input
                                  type="number"
                                  min={1} max={24}
                                  value={customConfigRows}
                                  onChange={(e) => setCustomConfigRows(Number(e.target.value) || 1)}
                                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Start Date</span>
                                <input
                                  type="date"
                                  value={customConfigStartDate}
                                  onChange={(e) => setCustomConfigStartDate(e.target.value)}
                                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Interval</span>
                              <Select
                                value={customConfigInterval}
                                onValueChange={(val: any) => setCustomConfigInterval(val)}
                              >
                                <SelectTrigger className="h-9 px-3 bg-slate-50 dark:bg-zinc-900 border-slate-200 text-xs font-bold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                                  <SelectItem value="BIMONTHLY">Bi-Monthly (Every 2 Months)</SelectItem>
                                  <SelectItem value="QUARTERLY">Quarterly (Every 3 Months)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                checked={customConfigLateFee}
                                onChange={(e) => setCustomConfigLateFee(e.target.checked)}
                                className="rounded text-indigo-500 focus:ring-indigo-500/20"
                              />
                              <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">Apply Standard Late Fees?</span>
                            </div>
                            <button
                              type="button"
                              onClick={generateCustomInstallments}
                              className="w-full py-2 bg-slate-800 hover:bg-slate-900 dark:bg-zinc-700 text-white rounded-lg text-[10px] font-extrabold tracking-widest uppercase transition-colors"
                            >
                              Generate Schedule
                            </button>
                          </div>
                        )}

                        {/* Optional Add-ons */}
                        {classFees.filter(f => f.applicability === "OPTIONAL").length > 0 && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 select-none">
                              Optional Add-ons
                            </span>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {classFees.filter(f => f.applicability === "OPTIONAL").map(fee => {
                                const isSelected = selectedOptionalFees.some(o => o.id === fee.id);
                                const selectedFee = selectedOptionalFees.find(o => o.id === fee.id);
                                return (
                                  <div key={fee.id} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${isSelected ? "border-amber-200 bg-white dark:border-amber-900/50 dark:bg-amber-900/20 shadow-sm" : "border-slate-200/60 dark:border-zinc-800 bg-transparent"}`}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => handleOptionalFeeToggle(fee, e.target.checked)}
                                      className="rounded text-amber-500 focus:ring-amber-500/20 w-4 h-4"
                                    />
                                    <div className="flex-1 flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{fee.name}</span>
                                      {isSelected ? (
                                        <div className="flex items-center gap-1 w-24">
                                          <span className="text-xs font-bold text-slate-400">₹</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={selectedFee?.amount || ""}
                                            onChange={(e) => handleOptionalFeeAmountChange(fee.id, Number(e.target.value))}
                                            className="w-full h-7 px-2 rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-950 text-xs font-bold text-amber-700 dark:text-amber-400 text-right outline-none focus:border-amber-400"
                                          />
                                        </div>
                                      ) : (
                                        <span className="text-[10px] font-bold text-slate-400">₹{formatIndianNumber(fee.amount)} / {fee.frequency.toLowerCase()}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Scholarship / Discount */}
                        <div className="flex flex-col gap-1.5 w-full pt-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                            Scholarship / Discount (%)
                          </span>
                          <div className="relative">
                            <input
                              type="number"
                              value={String(promoteForm.discountPercent)}
                              onChange={(e) => handlePromoteChange("discountPercent", e.target.value)}
                              placeholder="0"
                              className="w-full h-10 pl-4 pr-8 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-300"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">%</span>
                          </div>
                        </div>

                        {/* Dues Displays - LCD STYLE */}
                        <div className="pt-4 border-t-2 border-slate-800 dark:border-zinc-400 border-dashed space-y-3">
                          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                            <span className="uppercase tracking-widest">Base Fees</span>
                            <span className="font-mono">₹{formatIndianNumber(baseTotal)}</span>
                          </div>
                          {promoteForm.discountPercent > 0 && (
                            <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="uppercase tracking-widest">Discount ({promoteForm.discountPercent}%)</span>
                              <span className="font-mono">-₹{formatIndianNumber(baseTotal - totalDiscountedFee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-end pt-2">
                            <span className="uppercase tracking-widest font-black text-slate-800 dark:text-zinc-200 text-xs">Total Due</span>
                            <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white font-mono">
                              ₹{formatIndianNumber(totalDiscountedFee)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Jagged Bottom Edge */}
                      <div className="absolute -bottom-2 left-0 w-full h-2" style={{
                        backgroundImage: "linear-gradient(-45deg, transparent 75%, rgba(251, 243, 219, 0.4) 75%), linear-gradient(45deg, transparent 75%, rgba(251, 243, 219, 0.4) 75%)",
                        backgroundSize: "10px 10px",
                        backgroundRepeat: "repeat-x"
                      }}></div>
                    </div>
                  </div>

                  {/* Right: Installments Schedule Card (7 cols) */}
                  <div className="lg:col-span-7 p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/85 shadow-md shadow-slate-100/50 dark:shadow-none space-y-5 transition-all duration-300 hover:shadow-lg">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-zinc-800">
                      <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        <Icon name="receipt_long" size={14} />
                      </span>
                      <span className="font-extrabold uppercase tracking-wider text-[11px]">Fee Installments Schedule</span>
                    </h4>

                    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1.5 scrollbar-thin">
                      {customInstallments.map((inst, index) => {
                        return (
                          <div
                            key={inst.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all duration-250 ${
                              inst.checked
                                ? "bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 shadow-sm"
                                : "bg-slate-50/40 dark:bg-zinc-950/10 border-slate-100 dark:border-zinc-900 opacity-60"
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                id={`inst-check-${inst.id}`}
                                checked={inst.checked}
                                onChange={(e) => {
                                  const newInsts = [...customInstallments];
                                  newInsts[index].checked = e.target.checked;
                                  setCustomInstallments(newInsts);
                                }}
                                className="rounded text-primary focus:ring-primary/20 w-4.5 h-4.5 border-slate-300 dark:border-zinc-800"
                              />
                              <div className="flex flex-col gap-2 flex-1 max-w-[200px]">
                                {inst.isCustom ? (
                                  <input 
                                    type="text" 
                                    value={inst.name}
                                    onChange={(e) => {
                                      const newInsts = [...customInstallments];
                                      newInsts[index].name = e.target.value;
                                      setCustomInstallments(newInsts);
                                    }}
                                    disabled={!inst.checked}
                                    className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-b border-slate-200 dark:border-zinc-700 outline-none focus:border-primary px-1 pb-0.5"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 px-1">{inst.name}</span>
                                )}
                                
                                {inst.isCustom ? (
                                  <input 
                                    type="date" 
                                    value={inst.dueDate.split('T')[0]}
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      try {
                                        const d = new Date(e.target.value);
                                        if (!isNaN(d.getTime())) {
                                          const newInsts = [...customInstallments];
                                          newInsts[index].dueDate = d.toISOString();
                                          setCustomInstallments(newInsts);
                                        }
                                      } catch (err) {}
                                    }}
                                    disabled={!inst.checked}
                                    className="text-[10px] text-slate-500 dark:text-zinc-400 bg-transparent outline-none cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-[9px] text-slate-400 dark:text-zinc-500 block px-1">
                                    Due: {new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">₹</span>
                              <BaseCurrencyInput
                                disabled={!inst.checked}
                                value={String(inst.amount)}
                                onChange={(e) => {
                                  const newInsts = [...customInstallments];
                                  newInsts[index].amount = Number(e.target.value) || 0;
                                  setCustomInstallments(newInsts);
                                }}
                                className="w-24 h-9 text-xs font-bold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 text-right text-slate-800 dark:text-zinc-200 outline-none focus:border-primary disabled:opacity-50 transition-all duration-300"
                              />
                              {inst.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newInsts = customInstallments.filter((_, i) => i !== index);
                                    setCustomInstallments(newInsts);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors ml-1"
                                >
                                  <Icon name="delete" size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setCustomInstallments([
                          ...customInstallments, 
                          { 
                            id: `custom-${Date.now()}`, 
                            name: `Custom Installment ${customInstallments.length + 1}`, 
                            dueDate: new Date().toISOString(), 
                            amount: 0, 
                            checked: true, 
                            isCustom: true 
                          }
                        ]);
                      }}
                      className="w-full py-2.5 mt-2 border border-dashed border-primary/30 rounded-xl text-primary text-xs font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="add_circle" size={16} />
                      Add Custom Installment
                    </button>
                  </div>
                </div>

                {/* 3. Upfront Payment Summary Drawer */}
                <div className="p-5 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/20 dark:bg-zinc-950/20 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-2.5 border-slate-100 dark:border-zinc-800">
                    <Icon name="payments" size={15} className="text-emerald-500" />
                    Upfront Payment Processing
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* Amount Paid Now */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Amount Paid Now
                      </span>
                      <BaseCurrencyInput
                        value={String(promoteForm.amountPaid)}
                        onChange={(e) => handlePromoteChange("amountPaid", e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Payment Method
                      </span>
                      <Select
                        value={promoteForm.paymentMethod}
                        onValueChange={(val: any) => handlePromoteChange("paymentMethod", val)}
                      >
                        <SelectTrigger fullWidth className="h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-primary/20">
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
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Transaction ID
                      </span>
                      <input
                        type="text"
                        value={promoteForm.transactionId}
                        onChange={(e) => handlePromoteChange("transactionId", e.target.value)}
                        placeholder="e.g. TXN987654"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="p-4 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/10 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5">
                    <Icon name="warning" size={16} className="text-red-500 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

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
                  <button type="button" onClick={onClose} className="rounded-xl h-11 px-5 font-bold text-xs border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800">
                    Dismiss
                  </button>
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
                {selectedApp.archiveReason && (
                  <div className="max-w-md mx-auto p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-left space-y-1">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-rose-500 select-none">
                      Reason for Rejection
                    </span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 leading-relaxed">
                      {selectedApp.archiveReason}
                    </p>
                  </div>
                )}
                <div className="pt-2 flex justify-center gap-3">
                  {onReactivateApplicant && (
                    <Button
                      type="button"
                      variant="filled"
                      icon="refresh"
                      loading={reactivateLoading}
                      className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/15 cursor-pointer"
                      onClick={handleReactivateSubmit}
                    >
                      Reactivate Applicant
                    </Button>
                  )}
                  <button type="button" onClick={onClose} className="rounded-xl h-11 px-5 font-bold text-xs border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* STATUS: WITHDRAWN */}
            {selectedApp.status === "WITHDRAWN" && (
              <div className="py-10 text-center space-y-6">
                <span className="inline-flex items-center justify-center p-5 rounded-full bg-slate-50 dark:bg-zinc-800/60 text-slate-500 border border-slate-100 dark:border-zinc-800 shadow-sm">
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
                {selectedApp.archiveReason && (
                  <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10 text-left space-y-1">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                      Reason for Withdrawal
                    </span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 leading-relaxed">
                      {selectedApp.archiveReason}
                    </p>
                  </div>
                )}
                <div className="pt-2 flex justify-center gap-3">
                  {onReactivateApplicant && (
                    <Button
                      type="button"
                      variant="filled"
                      icon="refresh"
                      loading={reactivateLoading}
                      className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/15 cursor-pointer"
                      onClick={handleReactivateSubmit}
                    >
                      Reactivate Applicant
                    </Button>
                  )}
                  <button type="button" onClick={onClose} className="rounded-xl h-11 px-5 font-bold text-xs border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="max-w-[400px] rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-slate-100 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.08)] focus:outline-none">
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-zinc-55 tracking-tight flex items-center gap-2">
              <Icon name="person_off" className="text-rose-500" size={18} />
              Withdraw Application?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              This will move the candidate to the archive list as Withdrawn.
            </DialogDescription>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Reason for Withdrawal <span className="text-red-500">*</span>
              </span>
              <textarea
                rows={3}
                required
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="e.g. Admitted to another school, relocations..."
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all resize-none font-semibold"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outlined"
                onClick={() => {
                  setWithdrawDialogOpen(false);
                  setWithdrawReason("");
                }}
                className="rounded-xl h-10 px-4 font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={withdrawLoading}
                className="rounded-xl h-10 px-4 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-sm"
              >
                Withdraw Now
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
