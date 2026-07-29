"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { BaseCurrencyInput } from "@/components/ui/base-currency-input";
import { formatIndianNumber } from "@/lib/utils-format";

interface DocumentItem {
  id: string;
  documentType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  remarks: string | null;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
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
  tokens?: { id: string; token: string; expiresAt: string | Date; isConsumed: boolean }[] | null;
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
  previousSchool?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: string | null;
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
    discountAmount: number;
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
  const [workspaceMode, setWorkspaceMode] = useState<"action_desk" | "student_profile">("action_desk");
  const [activeTab, setActiveTab] = useState<"general" | "parents" | "docs">("general");
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<any>(selectedApp);

  useEffect(() => {
    setEditForm(selectedApp);
    setIsEditing(false);
    if (selectedApp && selectedApp.documents && setVerifyForm) {
      setVerifyForm((prev: any) => ({
        ...prev,
        documents: (selectedApp?.documents || []).map((d: any) => ({
          id: d.id,
          status: d.status,
          remarks: d.remarks || "",
          documentType: d.documentType,
          fileName: d.fileName,
          filePath: d.filePath,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
        })),
      }));
    }
  }, [selectedApp]);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState("BIRTH_CERTIFICATE");
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  
const DOCUMENT_META: Record<string, { label: string; badge: "MANDATORY" | "CONDITIONAL" | "ACCEPTED_VARIANTS"; badgeText: string; hint?: string; variants?: string[] }> = {
  BIRTH_CERTIFICATE: { label: "Birth Certificate", badge: "MANDATORY", badgeText: "🔴 Mandatory" },
  STUDENT_PHOTO: { label: "Student Photo", badge: "MANDATORY", badgeText: "🔴 Mandatory" },
  AADHAAR_CARD: { label: "Aadhaar Card", badge: "MANDATORY", badgeText: "🔴 Mandatory" },
  TRANSFER_CERTIFICATE: { label: "Transfer Certificate", badge: "CONDITIONAL", badgeText: "🟡 Class 2nd+", hint: "Required for Class 2nd & above" },
  PREVIOUS_MARKSHEET: { label: "Previous Marksheet", badge: "CONDITIONAL", badgeText: "🟡 Class 2nd+", hint: "Required for Class 2nd & above" },
  ADDRESS_PROOF: {
    label: "Address Proof",
    badge: "ACCEPTED_VARIANTS",
    badgeText: "🟢 Address Proof",
    variants: ["Aadhaar Card", "Electricity Bill", "Water Bill", "Passport", "Rent Agreement", "Ration Card", "Bank Passbook"]
  }
};

const DOC_TYPES = ["BIRTH_CERTIFICATE", "AADHAAR_CARD", "STUDENT_PHOTO", "PREVIOUS_MARKSHEET", "OTHER"];

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
  const discountAmt = promoteForm.discountAmount || 0;
  const totalDiscountedFee = Math.max(0, mandatoryTotal - discountAmt) + optionalTotal;

  const sumOfInstallments = customInstallments.reduce((acc, curr) => acc + (curr.checked ? curr.amount : 0), 0);
  const isBalanceMismatch = sumOfInstallments !== totalDiscountedFee;
  const isDiscountInvalid = discountAmt > mandatoryTotal;
  const isOverpayment = promoteForm.amountPaid > totalDiscountedFee;
  const isPromoteDisabled = actionLoading || isBalanceMismatch || isDiscountInvalid || isOverpayment;

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
          
          if (billingMode === "STANDARD" && inst.templateId) {
             const template = installmentTemplates.find(t => t.id === inst.templateId);
             if (template && baseTotal > 0) {
                // Proportional to the template's original amount
                const proportion = Number(template.amount) / baseTotal;
                rowAmount = Math.round(totalDiscountedFee * proportion);
             } else {
                rowAmount = Math.round(totalDiscountedFee / checkedInsts.length);
             }
          } else {
            rowAmount = Math.round(totalDiscountedFee / checkedInsts.length);
          }

          if (isLast) {
            rowAmount = remaining;
          } else {
            remaining -= rowAmount;
          }
          
          return { ...inst, amount: rowAmount };
        });
        
        // Deep compare to prevent unnecessary state updates
        const isDifferent = newInsts.some((inst, i) => inst.amount !== prev[i].amount);
        return isDifferent ? newInsts : prev;
      });
    }
  }, [totalDiscountedFee, customInstallments.length, setCustomInstallments, billingMode, installmentTemplates, baseTotal]);

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
    const currentStatus = nextDocs[index].status;
    const finalStatus = currentStatus === status ? "PENDING" : status;

    nextDocs[index] = { ...nextDocs[index], status: finalStatus };
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
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<any>(null);

  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [magicUploadData, setMagicUploadData] = useState<{
    magicUrl: string;
    whatsappUrl: string;
    isExpired: boolean;
    daysLeft: number;
  } | null>(null);

  // Auto-load existing token from selectedApp across page refreshes!
  useEffect(() => {
    if (selectedApp?.tokens && selectedApp.tokens.length > 0) {
      const latestToken = selectedApp.tokens[0];
      const expiresAtDate = new Date(latestToken.expiresAt);
      const isExpired = new Date() > expiresAtDate;

      const diffMs = expiresAtDate.getTime() - new Date().getTime();
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
      const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
      const magicUrl = `${protocol}//${host}/public/upload-docs/${latestToken.token}`;

      const parentPhone = selectedApp.fatherPhone || selectedApp.motherPhone || "";
      let cleanPhone = parentPhone.replace(/\D/g, "");
      if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
      const studentName = `${selectedApp.firstName} ${selectedApp.lastName}`.trim();
      const className = selectedApp.class?.name || "";

      const messageText = `Namaste! Please click this secure link to upload missing admission documents for *${studentName}* (${className}) [App No: ${selectedApp.applicationNo}]:\n\n👉 ${magicUrl}\n\nThank you,\n*${selectedApp.branch?.name || "School"} Admissions Desk*`;

      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
        : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

      setMagicUploadData({
        magicUrl,
        whatsappUrl,
        isExpired,
        daysLeft,
      });
    } else {
      setMagicUploadData(null);
    }
  }, [selectedApp]);

  const handleGenerateMagicLink = async (forceRenew = false) => {
    if (!selectedApp) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/generate-upload-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRenew }),
      });
      const json = await res.json();
      if (json.success) {
        const expiresAtDate = new Date(json.data.expiresAt);
        const diffMs = expiresAtDate.getTime() - new Date().getTime();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        setMagicUploadData({
          magicUrl: json.data.magicUrl,
          whatsappUrl: json.data.whatsappUrl,
          isExpired: false,
          daysLeft,
        });
        setFormError?.(null);
      } else {
        setFormError?.(json.error?.message || "Failed to generate upload link");
      }
    } catch {
      setFormError?.("Failed to generate upload link due to network error.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyMagicLink = () => {
    if (!magicUploadData?.magicUrl) return;
    navigator.clipboard.writeText(magicUploadData.magicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleDeleteDoc = async (doc: any) => {
    if (!doc) return;
    if (!doc.id) {
      setVerifyForm((prev: any) => ({
        ...prev,
        documents: prev.documents.filter((d: any) => d.documentType !== doc.documentType),
      }));
      setDeleteConfirmDoc(null);
      return;
    }
    setDeletingDocId(doc.id);
    clearError();

    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/documents/${doc.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setVerifyForm((prev: any) => ({
          ...prev,
          documents: prev.documents.filter((d: any) => d.id !== doc.id),
        }));

        if (onApplicantUpdated && data.application) {
          onApplicantUpdated(data.application);
        }
        setDeleteConfirmDoc(null);
      } else {
        setFormError?.(data.error?.message || "Failed to delete document");
      }
    } catch (err) {
      setFormError?.("Network error during document deletion.");
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleCounselorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    clearError();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", selectedDocType);

    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        const updatedDocs = (data.application?.documents || data.documents || []).map((d: any) => ({
          id: d.id,
          status: d.status,
          remarks: d.remarks || "",
          documentType: d.documentType,
          fileName: d.fileName,
          filePath: d.filePath,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
        }));

        setVerifyForm((prev: any) => ({
          ...prev,
          documents: updatedDocs,
        }));

        if (onApplicantUpdated) onApplicantUpdated(data.application || selectedApp);
      } else {
         setFormError?.(data.error?.message || "Failed to upload document");
      }
    } catch (err) {
      setFormError?.("Network error during document upload.");
    } finally {
      setUploadingDoc(false);
    }
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
      return { ...prev, [field]: value };
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
    <div className="w-full h-full flex flex-col bg-slate-50/60 dark:bg-zinc-950/40 relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
      {/* Header & Stepper Section */}
      <div className="bg-white dark:bg-zinc-950 border-b border-slate-200/60 dark:border-zinc-800 shrink-0">
        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Icon name="arrow_back" size={18} />
            </button>
            <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate max-w-[280px] sm:max-w-[400px]" title={`${selectedApp.firstName} ${selectedApp.lastName}`}>
              {selectedApp.firstName} {selectedApp.lastName}
            </h2>
            <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800/80 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-zinc-700/50 shrink-0">
              {selectedApp.applicationNo}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 shrink-0">
              {statusLabels[selectedApp.status] || selectedApp.status}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Silicon Valley Mode Switcher Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setWorkspaceMode("action_desk")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  workspaceMode === "action_desk"
                    ? "bg-white dark:bg-zinc-950 text-primary dark:text-sky-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon name="bolt" size={15} />
                <span>Stage Action Desk</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("student_profile")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  workspaceMode === "student_profile"
                    ? "bg-white dark:bg-zinc-950 text-primary dark:text-sky-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon name="person" size={15} />
                <span>Student Profile & Family</span>
              </button>
            </div>

            {selectedApp.status !== "ADMITTED" && selectedApp.status !== "REJECTED" && selectedApp.status !== "WITHDRAWN" && onWithdrawApplicant && (
              <button
                type="button"
                onClick={() => setWithdrawDialogOpen(true)}
                className="text-xs font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                title="Withdraw Application"
              >
                <Icon name="person_off" size={14} />
                <span className="hidden sm:inline">Withdraw</span>
              </button>
            )}
          </div>
        </div>

        {/* Stepper Pipeline (Visible in Action Desk Mode) */}
        {workspaceMode === "action_desk" && (
          <div className="px-6 py-2.5 bg-slate-50/60 dark:bg-zinc-900/40 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 overflow-x-auto select-none">
            <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</span>
              <span className="text-slate-700 dark:text-zinc-300 font-bold">Submitted</span>
            </div>

            <div className="h-0.5 flex-1 bg-slate-200 dark:bg-zinc-800 min-w-[20px] max-w-[60px]" />

            <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                selectedApp.status !== "SUBMITTED"
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-white ring-2 ring-primary/20"
              }`}>
                {selectedApp.status !== "SUBMITTED" ? "✓" : "2"}
              </span>
              <span className={selectedApp.status === "DOCUMENT_VERIFICATION" ? "text-primary dark:text-sky-400 font-bold" : "text-slate-500"}>
                Doc Verification
              </span>
            </div>

            {hasEntranceTest && (
              <>
                <div className="h-0.5 flex-1 bg-slate-200 dark:bg-zinc-800 min-w-[20px] max-w-[60px]" />
                <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    selectedApp.status === "SHORTLISTED" || selectedApp.status === "ADMITTED"
                      ? "bg-emerald-500 text-white"
                      : selectedApp.status === "TEST_SCHEDULED"
                      ? "bg-primary text-white ring-2 ring-primary/20"
                      : "bg-slate-200 dark:bg-zinc-800 text-slate-400"
                  }`}>
                    3
                  </span>
                  <span className={selectedApp.status === "TEST_SCHEDULED" ? "text-primary dark:text-sky-400 font-bold" : "text-slate-500"}>
                    Entrance Test
                  </span>
                </div>
              </>
            )}

            <div className="h-0.5 flex-1 bg-slate-200 dark:bg-zinc-800 min-w-[20px] max-w-[60px]" />

            <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                selectedApp.status === "ADMITTED"
                  ? "bg-emerald-500 text-white"
                  : selectedApp.status === "SHORTLISTED"
                  ? "bg-primary text-white ring-2 ring-primary/20"
                  : "bg-slate-200 dark:bg-zinc-800 text-slate-400"
              }`}>
                {hasEntranceTest ? "4" : "3"}
              </span>
              <span className={selectedApp.status === "SHORTLISTED" ? "text-primary dark:text-sky-400 font-bold" : "text-slate-500"}>
                Shortlisted
              </span>
            </div>

            <div className="h-0.5 flex-1 bg-slate-200 dark:bg-zinc-800 min-w-[20px] max-w-[60px]" />

            <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                selectedApp.status === "ADMITTED" ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-zinc-800 text-slate-400"
              }`}>
                {hasEntranceTest ? "5" : "4"}
              </span>
              <span className={selectedApp.status === "ADMITTED" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500"}>
                Enrolled
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-zinc-950 p-6">
        {workspaceMode === "student_profile" ? (
          <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="space-y-6 bg-white dark:bg-zinc-950 p-6 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-zinc-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <Icon name="edit" size={16} className="text-primary" />
                    Edit Student & Family Details
                  </h4>
                  <span className="text-[11px] text-slate-400">Update candidate information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">First Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.firstName || ""}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.lastName || ""}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.dateOfBirth ? new Date(editForm.dateOfBirth).toISOString().split('T')[0] : ""}
                      onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Gender</label>
                    <select
                      value={editForm.gender || "MALE"}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Blood Group</label>
                    <input
                      type="text"
                      placeholder="e.g. O+, A+"
                      value={editForm.bloodGroup || ""}
                      onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Emergency Contact</label>
                    <input
                      type="text"
                      placeholder="10-digit Mobile"
                      value={editForm.emergencyContact || ""}
                      onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                      className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Family Details Edit */}
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-zinc-300">Family Information</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/30 space-y-3">
                      <span className="text-[10px] font-bold uppercase text-primary">Father Details</span>
                      <input
                        type="text"
                        placeholder="Father Name"
                        value={editForm.fatherName || ""}
                        onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                      />
                      <input
                        type="text"
                        placeholder="Father Phone"
                        value={editForm.fatherPhone || ""}
                        onChange={(e) => setEditForm({ ...editForm, fatherPhone: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                      />
                      <input
                        type="email"
                        placeholder="Father Email"
                        value={editForm.fatherEmail || ""}
                        onChange={(e) => setEditForm({ ...editForm, fatherEmail: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                      />
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/30 space-y-3">
                      <span className="text-[10px] font-bold uppercase text-pink-500">Mother Details</span>
                      <input
                        type="text"
                        placeholder="Mother Name"
                        value={editForm.motherName || ""}
                        onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                      />
                      <input
                        type="text"
                        placeholder="Mother Phone"
                        value={editForm.motherPhone || ""}
                        onChange={(e) => setEditForm({ ...editForm, motherPhone: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                      />
                      <input
                        type="email"
                        placeholder="Mother Email"
                        value={editForm.motherEmail || ""}
                        onChange={(e) => setEditForm({ ...editForm, motherEmail: e.target.value })}
                        className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Residential Address</label>
                  <textarea
                    rows={2}
                    placeholder="Full Address..."
                    value={editForm.address || ""}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 h-10 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="filled"
                    loading={editLoading}
                    icon="check"
                    className="bg-primary text-white hover:bg-primary/95 rounded-xl h-10 px-5 font-bold shadow-md shadow-primary/15 cursor-pointer"
                  >
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            ) : (
              /* SMART 2-COLUMN ALL-IN-ONE VIEW (NO HERO CARD & NO EXTRA CLICKS!) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT CARD (7/12 = 60%): Student Personal & Academic Details */}
                <div className="lg:col-span-7 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                      <Icon name="person" size={16} className="text-primary" />
                      Student Personal & Academic Details
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm(selectedApp);
                        setIsEditing(true);
                      }}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-700 dark:text-zinc-300 hover:text-primary transition-colors flex items-center gap-1.5 text-xs font-bold shadow-2xs cursor-pointer"
                    >
                      <Icon name="edit" size={14} />
                      <span>Edit Profile</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedApp.firstName} {selectedApp.lastName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Class</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedApp.class?.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Year</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedApp.academicYear?.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Birth Date</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">
                        {new Date(selectedApp.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedApp.gender || "Not specified"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blood Group</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedApp.bloodGroup || "Not specified"}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emergency Contact</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">{selectedApp.emergencyContact || "Not specified"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Residential Address</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-1">
                        {[selectedApp.address, selectedApp.pincode].filter(Boolean).join(", ") || "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RIGHT CARD (5/12 = 40%): Family & Guardian Information */}
                <div className="lg:col-span-5 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-xs space-y-5">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <Icon name="family_restroom" size={16} className="text-emerald-600" />
                    Family & Guardian Information
                  </h4>

                  <div className="space-y-4">
                    {/* Father */}
                    <div className="p-3.5 rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-800 space-y-1.5">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Father Details</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">{selectedApp.fatherName || "Not specified"}</p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                        {selectedApp.fatherPhone && <span>📞 {selectedApp.fatherPhone}</span>}
                        {selectedApp.fatherEmail && <span>✉️ {selectedApp.fatherEmail}</span>}
                      </div>
                    </div>

                    {/* Mother */}
                    <div className="p-3.5 rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-800 space-y-1.5">
                      <span className="text-[10px] font-bold text-pink-500 uppercase tracking-wider block">Mother Details</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100">{selectedApp.motherName || "Not specified"}</p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                        {selectedApp.motherPhone && <span>📞 {selectedApp.motherPhone}</span>}
                        {selectedApp.motherEmail && <span>✉️ {selectedApp.motherEmail}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* WIZARD: DOCUMENT CHECK (Submitted or Document Verification stages) */}
            {(selectedApp.status === "SUBMITTED" || selectedApp.status === "DOCUMENT_VERIFICATION") && (
              <form onSubmit={onVerifyDocs} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
                {/* LEFT COLUMN: Documents Manager (60% width) */}
                <div className="lg:col-span-7 space-y-4 bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                        <Icon name="check_circle" size={18} className="text-amber-500" />
                        Document Verification Checklist
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-slate-200/50">
                      {verifyForm.documents.length} File(s) Uploaded
                    </span>
                  </div>

                  {/* WhatsApp Parent Upload Action Bar */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-blue-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                        📲
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span>Parent Mobile Upload Link</span>
                          {magicUploadData ? (
                            magicUploadData.isExpired ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                                🔴 Expired
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                🟢 Active ({magicUploadData.daysLeft}d left)
                              </span>
                            )
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                              WhatsApp Ready
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {magicUploadData?.isExpired
                            ? "This link has expired after 7 days. Click Renew to issue a fresh link to parents."
                            : "Send a 1-tap secure link to parents so they can upload documents from their phone."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!magicUploadData ? (
                        <button
                          type="button"
                          disabled={generatingLink}
                          onClick={() => handleGenerateMagicLink(false)}
                          className="h-8 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/20"
                        >
                          {generatingLink ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Icon name="share" size={14} />
                              <span>Generate Link</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          {!magicUploadData.isExpired && (
                            <>
                              <button
                                type="button"
                                onClick={handleCopyMagicLink}
                                className="h-8 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-zinc-700"
                              >
                                <Icon name={copiedLink ? "check" : "content_copy"} size={14} className={copiedLink ? "text-emerald-500" : ""} />
                                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                              </button>

                              <a
                                href={magicUploadData.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/20"
                              >
                                <span>📲</span>
                                <span>Send WhatsApp</span>
                              </a>
                            </>
                          )}

                          <button
                            type="button"
                            disabled={generatingLink}
                            onClick={() => handleGenerateMagicLink(true)}
                            className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              magicUploadData.isExpired
                                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20"
                                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700"
                            }`}
                            title="Renew and generate a fresh 7-day magic link"
                          >
                            <Icon name="sync" size={13} className={generatingLink ? "animate-spin" : ""} />
                            <span>{magicUploadData.isExpired ? "Renew Link" : "Renew"}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Documents List */}
                  {verifyForm.documents.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-2xl text-slate-400 bg-slate-50/50 dark:bg-zinc-900/30">
                      <Icon name="cloud_upload" size={28} className="opacity-40 mb-1.5" />
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">No documents uploaded yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Select a mandatory document below to upload.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {verifyForm.documents.map((doc, index) => {
                        const meta = DOCUMENT_META[doc.documentType] || { label: doc.documentType, badgeText: "Document" };
                        const isPdf = doc.filePath?.toLowerCase().endsWith(".pdf");

                        return (
                          <div
                            key={doc.id || doc.documentType}
                            className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/90 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md transition-all duration-200 group"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Left Meta & Status */}
                              <div className="flex items-start gap-3 min-w-0">
                                <span className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
                                  isPdf 
                                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-100 dark:border-rose-900/40"
                                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-100 dark:border-blue-900/40"
                                }`}>
                                  <Icon name={isPdf ? "picture_as_pdf" : "image"} size={20} />
                                </span>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                                      {meta.label}
                                    </h4>

                                    {/* Badge Pill */}
                                    {meta.badge === "MANDATORY" && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50">
                                        Mandatory
                                      </span>
                                    )}
                                    {meta.badge === "CONDITIONAL" && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50">
                                        Class 2nd+
                                      </span>
                                    )}
                                    {meta.badge === "ACCEPTED_VARIANTS" && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
                                        Address Proof
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                                    <span className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        doc.status === "VERIFIED"
                                          ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                                          : doc.status === "REJECTED"
                                          ? "bg-rose-500 shadow-xs shadow-rose-500/50"
                                          : "bg-amber-500 shadow-xs shadow-amber-500/50 animate-pulse"
                                      }`} />
                                      <strong className={`font-bold ${
                                        doc.status === "VERIFIED"
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : doc.status === "REJECTED"
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-amber-600 dark:text-amber-400"
                                      }`}>
                                        {doc.status}
                                      </strong>
                                    </span>

                                    {doc.fileName && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate max-w-[140px] text-slate-500 dark:text-zinc-400 font-mono text-[10px]">{doc.fileName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Action Cluster */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                {doc.filePath && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc(doc)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    title="Preview uploaded document"
                                  >
                                    <Icon name="visibility" size={13} />
                                    <span>Preview</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDocType(doc.documentType);
                                    fileInputRef.current?.click();
                                  }}
                                  className="h-8 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                  title="Replace file with a new upload"
                                >
                                  <Icon name="sync" size={13} />
                                  <span>Change</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmDoc(doc)}
                                  disabled={deletingDocId === doc.id}
                                  className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                                  title="Delete document"
                                >
                                  <Icon name="delete" size={15} />
                                </button>

                                {/* Approve / Reject Segmented Switch */}
                                <div className="flex items-center gap-0.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200/60 dark:border-zinc-700/60">
                                  <button
                                    type="button"
                                    onClick={() => handleDocStatusChange(index, "VERIFIED")}
                                    title={doc.status === "VERIFIED" ? "Click to reset status to Pending" : "Approve document"}
                                    className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                      doc.status === "VERIFIED" 
                                        ? "bg-emerald-600 text-white shadow-sm" 
                                        : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                                    }`}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDocStatusChange(index, "REJECTED")}
                                    title={doc.status === "REJECTED" ? "Click to reset status to Pending" : "Reject document"}
                                    className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                      doc.status === "REJECTED" 
                                        ? "bg-rose-600 text-white shadow-sm" 
                                        : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                                    }`}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Remarks Input Sub-Bar */}
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
                              <input
                                type="text"
                                placeholder="Add verification remarks or mismatch note..."
                                value={doc.remarks || ""}
                                onChange={(e) => handleDocRemarksChange(index, e.target.value)}
                                className="w-full h-8 px-3 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800 dark:text-zinc-200 transition-all placeholder:text-slate-400"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SMART UPLOAD SECTION: Auto-filter already uploaded & verified documents */}
                  {(() => {
                    // Filter out documents that are already uploaded and VERIFIED
                    const availableDocTypes = DOC_TYPES.filter(type => {
                      const existing = verifyForm.documents.find((d: any) => d.documentType === type);
                      return !existing || existing.status === "REJECTED";
                    });

                    if (availableDocTypes.length === 0) {
                      return (
                        <div className="p-3.5 rounded-xl border border-emerald-200/60 bg-emerald-50/40 text-emerald-800 text-xs font-bold flex items-center gap-2">
                          <Icon name="check_circle" size={18} className="text-emerald-600 shrink-0" />
                          <span>✨ All required checklist documents have been uploaded.</span>
                        </div>
                      );
                    }

                    const activeMeta = DOCUMENT_META[selectedDocType] || { label: selectedDocType, badgeText: "Document" };

                    return (
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Upload Missing Document
                        </span>
                        <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/20 flex flex-col sm:flex-row items-center gap-3">
                          <div className="flex-1 w-full">
                            <Select
                              value={selectedDocType}
                              onValueChange={(val) => setSelectedDocType(val)}
                            >
                              <SelectTrigger className="w-full h-10 px-3.5 text-xs rounded-xl border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 font-medium focus:ring-2 focus:ring-primary/20 shadow-2xs">
                                <SelectValue placeholder="Select Document Type..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-slate-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900 p-1">
                                {availableDocTypes.map((type) => {
                                  const meta = DOCUMENT_META[type] || { label: type, badgeText: "" };
                                  return (
                                    <SelectItem key={type} value={type} className="rounded-xl text-xs py-2.5 cursor-pointer focus:bg-slate-100 dark:focus:bg-zinc-800">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${
                                          meta.badge === "MANDATORY"
                                            ? "bg-rose-500"
                                            : meta.badge === "CONDITIONAL"
                                            ? "bg-amber-500"
                                            : "bg-emerald-500"
                                        }`} />
                                        <span className="font-bold text-slate-800 dark:text-zinc-200">{meta.label}</span>
                                        {meta.badgeText && (
                                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-auto">({meta.badgeText})</span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>

                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleCounselorUpload}
                            className="hidden"
                            accept="image/*,.pdf"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingDoc}
                            className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:bg-primary/95 transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-md shadow-primary/10"
                          >
                            {uploadingDoc ? <Icon name="sync" size={14} className="animate-spin" /> : <Icon name="cloud_upload" size={15} />}
                            {uploadingDoc ? "Uploading..." : "Upload File"}
                          </button>
                        </div>

                        {/* Helper info for Address Proof Variants */}
                        {activeMeta.variants && (
                          <div className="p-2.5 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <Icon name="info" size={14} className="shrink-0 mt-0.5" />
                            <span>
                              <strong>Accepted Address Proofs:</strong> {activeMeta.variants.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* RIGHT COLUMN: Action & Decision Panel (40% width) */}
                <div className="lg:col-span-5 space-y-4 bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <Icon name="gavel" size={18} className="text-primary" />
                    Verification Decision
                  </h3>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Next Stage Transition
                    </label>
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
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium pt-1">
                      {verifyForm.nextStatus === "TEST_SCHEDULED"
                        ? "✨ Promotes candidate to Entrance Exam scheduling."
                        : verifyForm.nextStatus === "SHORTLISTED"
                        ? "✨ Shortlists candidate for Registrar promotion."
                        : verifyForm.nextStatus === "REJECTED"
                        ? "⚠️ Moves candidate to archives as Rejected."
                        : "✨ Holds candidate at Verification Stage."}
                    </p>
                  </div>

                  {verifyForm.nextStatus === "REJECTED" && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
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

                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Verification Notes
                    </span>
                    <textarea
                      rows={3}
                      value={verifyForm.verificationNotes}
                      onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, verificationNotes: e.target.value }))}
                      placeholder="Record mismatches or requests for re-upload..."
                      className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800 dark:text-zinc-200 transition-all resize-none"
                    />
                  </div>

                  {formError && (
                    <div className="p-3 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/10 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <Icon name="warning" size={16} className="text-red-500 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="filled"
                      icon="check"
                      loading={actionLoading}
                      className="w-full bg-primary text-white hover:bg-primary/95 rounded-xl h-11 font-bold shadow-md shadow-primary/15"
                    >
                      Save Verification Details
                    </Button>
                  </div>
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

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Marks Obtained
                    </label>
                    <input
                      type="number"
                      value={examForm.marksObtained !== null ? String(examForm.marksObtained) : ""}
                      onChange={(e) => handleExamChange("marksObtained", e.target.value)}
                      placeholder="e.g. 85"
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Exam Verdict / Status <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={examForm.verdict}
                      onValueChange={(val: any) => handleExamChange("verdict", val)}
                    >
                      <SelectTrigger fullWidth className="h-12 rounded-xl border-slate-200 dark:border-zinc-800 text-sm font-semibold">
                        <SelectValue placeholder="Select Verdict" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASSED">Passed (Recommend for Shortlist)</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="PENDING">Pending Evaluation</SelectItem>
                        <SelectItem value="ABSENT">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Evaluator Notes
                    </label>
                    <input
                      type="text"
                      value={examForm.notes}
                      onChange={(e) => handleExamChange("notes", e.target.value)}
                      placeholder="Observation during test..."
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>
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
                        <SelectItem value="TEST_SCHEDULED">Keep at Entrance Exam (Hold)</SelectItem>
                        <SelectItem value="SHORTLISTED">Shortlist Candidate (Pass)</SelectItem>
                        <SelectItem value="REJECTED">Reject Candidate (Fail)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center pl-1 font-semibold">
                      <span>
                        {examForm.applicationStatus === "SHORTLISTED"
                          ? "✨ Promotes candidate to Shortlisted status."
                          : examForm.applicationStatus === "REJECTED"
                          ? "⚠️ Rejects candidate based on exam performance."
                          : "✨ Keeps candidate at Entrance Exam stage."}
                      </span>
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
                    icon="check"
                    loading={actionLoading}
                    className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/15"
                  >
                    Save Exam Result
                  </Button>
                </div>
              </form>
            )}

            {/* WIZARD: SHORTLISTED */}
            {selectedApp.status === "SHORTLISTED" && (
              <form onSubmit={onPromote} className="space-y-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                  <Icon name="school" size={16} className="text-emerald-500" />
                  Shortlist Selection & Fee Allocation
                </h3>

                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                  <Icon name="info" size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    <p className="font-bold text-amber-700 dark:text-amber-400">Class Section & Fee Allocation</p>
                    <p className="mt-0.5">Assign section, roll number, and confirm fee installments to promote candidate to Enrolled Student Status.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Assign Section <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={promoteForm.sectionId}
                      onValueChange={(val: any) => handlePromoteChange("sectionId", val)}
                    >
                      <SelectTrigger fullWidth className="h-12 rounded-xl border-slate-200 dark:border-zinc-800 text-sm font-semibold">
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSections.map((sec) => (
                          <SelectItem key={sec.id} value={sec.id}>Section {sec.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      value={promoteForm.rollNo}
                      onChange={(e) => handlePromoteChange("rollNo", e.target.value)}
                      placeholder="e.g. 101"
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>

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
                    disabled={isPromoteDisabled}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl h-11 px-6 font-bold shadow-md shadow-emerald-600/15"
                  >
                    Confirm Admission & Enroll Candidate
                  </Button>
                </div>
              </form>
            )}

            {/* WIZARD: ADMITTED */}
            {selectedApp.status === "ADMITTED" && (
              <div className="py-10 text-center space-y-6 animate-in fade-in duration-300">
                <span className="inline-flex items-center justify-center p-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200/50 shadow-sm">
                  <Icon name="check_circle" size={48} />
                </span>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                    Candidate Successfully Enrolled!
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    This candidate is now a fully registered student in Student Information System (SIS).
                  </p>
                </div>
              </div>
            )}

            {/* STATUS: REJECTED */}
            {selectedApp.status === "REJECTED" && (
              <div className="py-10 text-center space-y-6">
                <span className="inline-flex items-center justify-center p-5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200/50 shadow-sm">
                  <Icon name="cancel" size={48} />
                </span>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                    Application Rejected
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    This candidate application was rejected during processing.
                  </p>
                </div>
                {selectedApp.archiveReason && (
                  <div className="max-w-md mx-auto p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-left space-y-1">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-red-500 select-none">
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
        )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmDoc} onOpenChange={(open) => !open && setDeleteConfirmDoc(null)}>
        <DialogContent className="max-w-[380px] rounded-3xl bg-white dark:bg-zinc-900 p-6 border border-slate-100 dark:border-zinc-800 shadow-2xl focus:outline-none">
          <div className="space-y-4 text-center">
            <span className="inline-flex items-center justify-center p-3 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200/50 shadow-2xs">
              <Icon name="delete_forever" size={28} />
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Delete Document File?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-zinc-200">{deleteConfirmDoc?.documentType?.replace(/_/g, " ")}</strong>? The file will be removed from storage and restored to the dropdown.
              </DialogDescription>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outlined"
                onClick={() => setDeleteConfirmDoc(null)}
                className="rounded-xl h-10 px-4 font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                loading={deletingDocId === deleteConfirmDoc?.id}
                onClick={() => handleDeleteDoc(deleteConfirmDoc)}
                className="rounded-xl h-10 px-5 font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white border-0 shadow-sm shadow-rose-600/20"
              >
                Delete File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)} document={previewDoc} />
    </div>
  );
}
