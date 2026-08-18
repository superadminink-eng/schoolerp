"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  status: "PENDING" | "VERIFIED" | "REJECTED" | "HARDCOPY_SUBMITTED";
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
  documents?: { id: string; documentType: string; status: "PENDING" | "VERIFIED" | "REJECTED" | "HARDCOPY_SUBMITTED"; remarks: string | null }[] | null;
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
  isProvisional?: boolean;
  provisionalDeadline?: string | null;
  overrideReason?: string | null;
  enrolledStudent?: any;
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
    isProvisional: boolean;
    provisionalDeadline: string;
    provisionalReason: string;
    overrideReason: string;
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
  const [cachedCustomInstallments, setCachedCustomInstallments] = useState<any[]>([]);
  const [isEnrollingLocally, setIsEnrollingLocally] = useState(false);

  useEffect(() => {
    setEditForm(selectedApp);
    setIsEditing(false);
    setCachedCustomInstallments([]);
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
  const [markingHardcopy, setMarkingHardcopy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dedicated state for the "Upload Scan" feature
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [uploadScanDocType, setUploadScanDocType] = useState<string | null>(null);
  const [scanningDocType, setScanningDocType] = useState<string | null>(null);

  // Dedicated state for "Replace Document" feature
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceDocType, setReplaceDocType] = useState<string | null>(null);
  const [isReplacingDocType, setIsReplacingDocType] = useState<string | null>(null);

  const [selectedDocType, setSelectedDocType] = useState("BIRTH_CERTIFICATE");
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  // Micro-Feedback Popover State & Instant Verification
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const [updatingDocAction, setUpdatingDocAction] = useState<string | null>(null);
  const [updatingDocRemarks, setUpdatingDocRemarks] = useState<string | null>(null);
  const [rejectPopoverIndex, setRejectPopoverIndex] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<any>(null);

  // Global Processing Lock
  const isProcessingRef = useRef(false);
  const isAnyDocProcessing = !!updatingDocId || !!deletingDocId || uploadingDoc || markingHardcopy || !!scanningDocType || !!isReplacingDocType;

  const [isOtherReason, setIsOtherReason] = useState(false);

  const REJECTION_REASONS = [
    { label: "Blurry / Unreadable", icon: "blur_on" },
    { label: "Wrong Document Uploaded", icon: "find_replace" },
    { label: "Missing Signature / Stamp", icon: "draw" },
    { label: "Expired Document", icon: "event_busy" },
    { label: "Incomplete Pages", icon: "auto_stories" },
    { label: "Name Mismatch", icon: "badge" },
    { label: "File Corrupted", icon: "broken_image" },
    { label: "Other / Custom", icon: "edit_note" }
  ];

  // Targeted Micro-Polling for Live Document Updates
  useEffect(() => {
    if (!selectedApp?.id || !setVerifyForm) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/admissions/applications/${selectedApp.id}?t=${Date.now()}`, { cache: "no-store" });
        const data = await response.json();
        
        if (data.success && data.data?.documents) {
          // Merge incoming documents with the current state to preserve local, unsubmitted remarks if any
          setVerifyForm((prev: any) => {
            const currentDocs = prev.documents || [];
            const newDocs = data.data.documents || [];
            
            const mergedDocs = newDocs.map((freshDoc: any) => {
              const currentDoc = currentDocs.find((d: any) => d.id === freshDoc.id || d.documentType === freshDoc.documentType);
              
              if (!currentDoc) {
                return freshDoc;
              }
              
              return {
                ...currentDoc,
                id: freshDoc.id, // Update ID in case it was a new record
                status: freshDoc.status,
                fileName: freshDoc.fileName,
                filePath: freshDoc.filePath,
                fileSize: freshDoc.fileSize,
                mimeType: freshDoc.mimeType,
                remarks: currentDoc.remarks !== freshDoc.remarks && currentDoc.remarks !== "" ? currentDoc.remarks : freshDoc.remarks || "",
              };
            });

            return {
              ...prev,
              documents: mergedDocs,
            };
          });
        }
      } catch (error) {
        console.error("Micro-polling failed:", error);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(pollInterval);
  }, [selectedApp?.id, setVerifyForm]);
  
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

  // Smart Auto-Selection Logic
  const availableDocTypes = useMemo(() => {
    return DOC_TYPES.filter(type => {
      const existing = verifyForm?.documents?.find((d: any) => d.documentType === type);
      return !existing || existing.status === "REJECTED";
    }).sort((a, b) => {
      const metaA = DOCUMENT_META[a];
      const metaB = DOCUMENT_META[b];
      if (metaA?.badge === "MANDATORY" && metaB?.badge !== "MANDATORY") return -1;
      if (metaB?.badge === "MANDATORY" && metaA?.badge !== "MANDATORY") return 1;
      return 0;
    });
  }, [verifyForm?.documents]);

  useEffect(() => {
    if (availableDocTypes.length > 0 && !availableDocTypes.includes(selectedDocType)) {
      setSelectedDocType(availableDocTypes[0]);
    }
  }, [availableDocTypes, selectedDocType]);

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

  // Doc verification change handlers (Instant Save)
  const handleDocStatusChange = async (index: number, requestedStatus: "PENDING" | "VERIFIED" | "REJECTED" | "HARDCOPY_SUBMITTED", overrideRemarks?: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    clearError();
    const doc = verifyForm.documents[index];
    if (!doc || !doc.id) {
      isProcessingRef.current = false;
      return; // Cannot verify a document that hasn't been saved yet
    }
    
    let finalStatus = requestedStatus;
    // If the UI requests PENDING (un-checking), but there is no digital file, it must be a physical hardcopy
    if (finalStatus === "PENDING" && !doc.filePath && !doc.fileName) {
      finalStatus = "HARDCOPY_SUBMITTED";
    }

    setUpdatingDocId(doc.id);
    setUpdatingDocAction(finalStatus);
    setUpdatingDocRemarks(overrideRemarks || null);
    
    let finalRemarks = overrideRemarks !== undefined ? overrideRemarks : doc.remarks;
    if (finalRemarks === "SYSTEM_REUPLOADED") {
      finalRemarks = null;
    }

    try {
      const response = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: finalStatus, remarks: finalRemarks }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update document status");
      }

      // Safe State Update using functional pattern
      setVerifyForm((prev: any) => {
        const nextDocs = [...prev.documents];
        nextDocs[index] = { ...doc, status: finalStatus, remarks: finalRemarks };
        
        const allVerified = nextDocs.every((d: any) => d.status === "VERIFIED");
        let recommendedNextStatus = prev.nextStatus;

        if (allVerified && recommendedNextStatus === "DOCUMENT_VERIFICATION") {
          recommendedNextStatus = hasEntranceTest ? "TEST_SCHEDULED" : "SHORTLISTED";
        } else if (!allVerified && (recommendedNextStatus === "TEST_SCHEDULED" || recommendedNextStatus === "SHORTLISTED")) {
          recommendedNextStatus = "DOCUMENT_VERIFICATION";
        }

        return {
          ...prev,
          documents: nextDocs,
          nextStatus: recommendedNextStatus,
        };
      });

    } catch (err: any) {
      setFormError?.(err.message || "Failed to update document status");
    } finally {
      setUpdatingDocId(null);
      setUpdatingDocAction(null);
      setUpdatingDocRemarks(null);
      if (requestedStatus === "REJECTED") {
        setRejectPopoverIndex(null);
      }
      isProcessingRef.current = false;
    }
  };

  const handleDocRemarksChange = (index: number, remarks: string) => {
    clearError();
    const nextDocs = [...verifyForm.documents];
    nextDocs[index] = { ...nextDocs[index], remarks };
    setVerifyForm((prev: any) => ({ ...prev, documents: nextDocs }));
  };

  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [magicUploadData, setMagicUploadData] = useState<{
    magicUrl: string;
    whatsappUrl: string;
    isExpired: boolean;
    daysLeft: number;
  } | null>(null);

  // Validation helper for Provisional Admission Bypass
  const mandatoryDocTypes = Object.keys(DOCUMENT_META).filter(k => DOCUMENT_META[k as keyof typeof DOCUMENT_META].badge === "MANDATORY");
  const hasAllMandatoryDocs = mandatoryDocTypes.every(type => {
    return verifyForm.documents.some((d: any) => 
      d.documentType === type && (d.status === "VERIFIED" || d.status === "HARDCOPY_SUBMITTED")
    );
  });

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
    if (!file || !selectedDocType) return;

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

  const handleReplaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceDocType) return;
    await executeReplace(file, replaceDocType);
  };

  const executeReplace = async (file: File, docType: string) => {
    // Basic validations
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setFormError?.("Only JPG, PNG, WEBP, and PDF files are allowed.");
      return;
    }
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFormError?.(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
      return;
    }

    setIsReplacingDocType(docType);
    clearError();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", docType);

    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (replaceInputRef.current) replaceInputRef.current.value = "";
        
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

        // If preview is open, update it
        if (previewDoc && previewDoc.documentType === replaceDocType) {
           const newDoc = updatedDocs.find((d: any) => d.documentType === replaceDocType);
           if (newDoc) setPreviewDoc(newDoc);
        }

        if (onApplicantUpdated) onApplicantUpdated(data.application || selectedApp);
      } else {
         setFormError?.(data.error?.message || "Failed to replace document");
      }
    } catch (err: any) {
      setFormError?.("Network error during document replacement.");
    } finally {
      setIsReplacingDocType(null);
      setReplaceDocType(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);

  const handleScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadScanDocType) return;

    setScanningDocType(uploadScanDocType);
    clearError();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", uploadScanDocType);

    try {
      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (scanInputRef.current) scanInputRef.current.value = "";
        
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
         setFormError?.(data.error?.message || "Failed to upload scanned document");
         alert("API Error: " + (data.error?.message || "Failed to upload scanned document"));
      }
    } catch (err: any) {
      setFormError?.("Network error during scan upload.");
      alert("Network Error: " + err.message);
    } finally {
      setScanningDocType(null);
      setUploadScanDocType(null);
    }
  };

  const handleMarkHardcopy = async () => {
    if (!selectedDocType) return;
    setMarkingHardcopy(true);
    clearError();
    try {
      const formData = new FormData();
      formData.append("documentType", selectedDocType);
      formData.append("isHardcopy", "true");

      const res = await fetch(`/api/v1/admissions/applications/${selectedApp.id}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDocType("");
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
        setFormError?.(data.error?.message || "Failed to mark hardcopy");
        alert("API Error: " + (data.error?.message || "Failed to mark hardcopy"));
      }
    } catch (err: any) {
      setFormError?.("Network error");
      alert("Network Error: " + err.message);
    } finally {
      setMarkingHardcopy(false);
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

  const handleInstallmentDateChange = (id: string, newDateStr: string) => {
    if (!setCustomInstallments || !newDateStr) return;
    setCustomInstallments((prev: any[]) => prev.map(inst => 
      inst.id === id 
        ? { ...inst, dueDate: newDateStr + "T00:00:00.000Z" } 
        : inst
    ));
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

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to update application");
      }

      onApplicantUpdated(json.data);
      setIsEditing(false);
    } catch (error: any) {
      console.error("Error updating application:", error);
      alert(error.message || "Failed to update application details.");
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
            {selectedApp.isProvisional && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/50 shrink-0" title={`Reason: ${selectedApp.overrideReason}`}>
                Provisional
              </span>
            )}
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
      {selectedApp.status === "ADMITTED" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-500 fade-in bg-slate-50/50 dark:bg-zinc-950/50 relative overflow-hidden">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 dark:border-zinc-800 p-8 text-center flex flex-col items-center relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="size-20 mx-auto bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-inner mb-6 border border-emerald-100 dark:border-emerald-900">
                <Icon name="verified" size={42} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mb-2">Enrollment Successful!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                <span className="font-bold text-slate-700 dark:text-slate-300">{selectedApp.firstName} {selectedApp.lastName}</span> is now officially a student. 
                <br />
                <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm">
                  Admission No: <span className="font-bold text-slate-800 dark:text-zinc-200 tracking-wide">{selectedApp.enrolledStudent?.admissionNo || "Pending Generation"}</span>
                </span>
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={() => {
                    const paymentId = (selectedApp.enrolledStudent as any)?.paymentId;
                    if (paymentId) {
                      window.open(`/fees/receipt/${paymentId}/print`, '_blank');
                    } else if (selectedApp.enrolledStudent?.id) {
                      window.open(`/fees/${selectedApp.enrolledStudent.id}`, '_blank');
                    } else {
                      alert('No fee payment was made during enrollment.');
                    }
                  }}
                  className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  <Icon name="receipt_long" size={18} />
                  Print Fee Receipt
                </button>
                
                <button 
                  onClick={() => window.open(`/students/${selectedApp.enrolledStudent?.id || ''}`, '_blank')}
                  className="w-full h-11 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 transition-all active:scale-[0.98]"
                >
                  <Icon name="person" size={18} />
                  View Student Profile
                </button>

                <button 
                  onClick={onClose} 
                  className="w-full h-10 mt-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 font-bold transition-colors text-sm"
                >
                  Close & Enroll Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar bg-slate-50/30 dark:bg-zinc-950 p-3 md:p-4 lg:p-4">
        <div className="max-w-7xl mx-auto w-full">
        {workspaceMode === "student_profile" ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="space-y-6 bg-white dark:bg-zinc-950 p-4 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs">
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* LEFT CARD (7/12 = 60%): Student Personal & Academic Details */}
                <div className="lg:col-span-7 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-xs space-y-5">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                <div className="lg:col-span-5 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 shadow-xs space-y-5">
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
              <form onSubmit={onVerifyDocs} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-300">
                {/* LEFT COLUMN: Documents Manager (60% width) */}
                <div className="lg:col-span-7 space-y-2 bg-white dark:bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-slate-200/40 dark:border-zinc-800/40 shadow-sm relative">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800/80 pb-3 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        <Icon name="check_circle" size={18} className="text-primary" />
                        Checklist
                      </h3>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        {verifyForm.documents.length} Uploaded
                      </span>
                    </div>

                    {/* Minimal WhatsApp Action */}
                    <div className="flex items-center gap-2">
                      {magicUploadData?.isExpired === false ? (
                        <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-lg p-1">
                          <button
                            type="button"
                            onClick={handleCopyMagicLink}
                            className="h-7 px-2.5 rounded-md text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1.5"
                          >
                            <Icon name={copiedLink ? "check" : "content_copy"} size={13} />
                            {copiedLink ? "Copied" : "Copy"}
                          </button>
                          <a
                            href={magicUploadData.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 px-2.5 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-xs"
                          >
                            WhatsApp Link
                          </a>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={generatingLink}
                          onClick={() => handleGenerateMagicLink(magicUploadData ? true : false)}
                          className="h-8 px-3 rounded-lg text-[11px] font-bold bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5 border border-slate-200/50 dark:border-zinc-700/50 shadow-2xs cursor-pointer"
                        >
                          <Icon name={generatingLink ? "sync" : (magicUploadData ? "refresh" : "share")} size={14} className={generatingLink ? "animate-spin" : ""} />
                          <span>{generatingLink ? "Wait..." : (magicUploadData ? "Renew Link" : "Request via WhatsApp")}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Documents List */}
                  {verifyForm.documents.length === 0 ? (
                    <div className="py-10 text-center rounded-xl text-slate-400 bg-slate-50/30 dark:bg-zinc-900/10">
                      <Icon name="cloud_upload" size={24} className="opacity-30 mb-2" />
                      <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">No documents uploaded yet</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Use the add document field below.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {verifyForm.documents.map((doc, index) => {
                        const meta = DOCUMENT_META[doc.documentType] || { label: doc.documentType, badgeText: "Document" };
                        const isPdf = doc.filePath?.toLowerCase().endsWith(".pdf");
                        const isThisDocProcessing = updatingDocId === doc.id || deletingDocId === doc.id || scanningDocType === doc.documentType || isReplacingDocType === doc.documentType;
                        const shouldDim = isAnyDocProcessing && !isThisDocProcessing;

                        return (
                          <div 
                            key={doc.id || index} 
                            className="grid grid-cols-12 gap-4 items-center relative"
                            onDragOver={(e) => { e.preventDefault(); setDragOverDocId(doc.id); }}
                            onDragLeave={(e) => { e.preventDefault(); setDragOverDocId(null); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverDocId(null);
                              const file = e.dataTransfer.files?.[0];
                              if (file) executeReplace(file, doc.documentType);
                            }}
                          >
                            {/* Drag Drop Overlay */}
                            {dragOverDocId === doc.id && (
                              <div className="absolute inset-0 z-50 bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-[2px] border-2 border-dashed border-blue-500 rounded-xl flex items-center justify-center pointer-events-none">
                                <div className="bg-white dark:bg-zinc-900 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                                  <Icon name="cloud_upload" size={20} />
                                  Drop to Replace
                                </div>
                              </div>
                            )}

                            {/* Display Mode */}
                            <div className="col-span-12">
                              <div className={`flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border ${dragOverDocId === doc.id ? 'border-transparent' : 'border-slate-200 dark:border-zinc-800'} rounded-xl shadow-sm hover:shadow-md transition-all duration-300 relative ${shouldDim ? 'opacity-50 grayscale-[0.5] pointer-events-none' : ''}`}>
                                <div className="flex items-center gap-4">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                    doc.status === "HARDCOPY_SUBMITTED"
                                      ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-500 border-amber-200/50 dark:border-amber-900/40"
                                      : isPdf 
                                      ? "bg-rose-50 text-rose-500 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100/40 dark:border-rose-900/30"
                                      : "bg-blue-50 text-blue-500 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100/40 dark:border-blue-900/30"
                                  }`}>
                                    <Icon name={doc.status === "HARDCOPY_SUBMITTED" ? "folder_special" : isPdf ? "picture_as_pdf" : "image"} size={16} />
                                  </div>
                                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate leading-none">
                                        {meta.label}
                                      </span>
                                      {doc.remarks === "SYSTEM_REUPLOADED" && doc.status === "PENDING" && (
                                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                          <Icon name="change_circle" size={10} />
                                          Re-Uploaded
                                        </span>
                                      )}
                                    </div>
                                    {doc.status === "HARDCOPY_SUBMITTED" ? (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-500 truncate mt-1 leading-none font-semibold flex items-center gap-1">
                                        Physical Hardcopy
                                      </span>
                                    ) : doc.fileName ? (
                                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-1 leading-none font-medium">
                                        {doc.fileName}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {/* Right Actions & Status */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {doc.status === "HARDCOPY_SUBMITTED" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUploadScanDocType(doc.documentType);
                                        setTimeout(() => scanInputRef.current?.click(), 50);
                                      }}
                                      disabled={isAnyDocProcessing}
                                      className="h-7 px-2 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 flex items-center justify-center transition-colors cursor-pointer text-[10px] font-bold gap-1 shadow-sm disabled:opacity-50"
                                      title="Upload scanned file"
                                    >
                                      {scanningDocType === doc.documentType ? <Icon name="sync" size={12} className="animate-spin" /> : <Icon name="upload" size={12} />}
                                      <span>{scanningDocType === doc.documentType ? "Uploading..." : "Upload Scan"}</span>
                                    </button>
                                  )}
                                  {doc.filePath && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDoc(doc)}
                                      disabled={isAnyDocProcessing}
                                      className="w-7 h-7 rounded-md text-slate-400 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                      title="Preview"
                                    >
                                      <Icon name="visibility" size={15} />
                                    </button>
                                  )}

                                  {/* Silicon Valley Replace Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplaceDocType(doc.documentType);
                                      setTimeout(() => replaceInputRef.current?.click(), 50);
                                    }}
                                    disabled={isAnyDocProcessing}
                                    className="w-7 h-7 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                    title="Replace document"
                                  >
                                    {isReplacingDocType === doc.documentType ? <Icon name="sync" size={14} className="animate-spin" /> : <Icon name="upload" size={14} />}
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmDoc(doc)}
                                    disabled={isAnyDocProcessing}
                                    className="w-7 h-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                    title="Delete document"
                                  >
                                    <Icon name="delete" size={14} />
                                  </button>

                                  <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

                                  {/* Silicon Valley Pill Toggles */}
                                  <div className="flex items-center p-0.5 bg-slate-100/80 dark:bg-zinc-800/50 rounded-lg border border-slate-200/50 dark:border-zinc-700/50">
                                    <button
                                      type="button"
                                      onClick={() => handleDocStatusChange(index, doc.status === "VERIFIED" ? "PENDING" : "VERIFIED")}
                                      disabled={isAnyDocProcessing}
                                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                        updatingDocId === doc.id && (updatingDocAction === "VERIFIED" || (doc.status === "VERIFIED" && updatingDocAction === "PENDING"))
                                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                                          : doc.status === "VERIFIED"
                                          ? "bg-emerald-500 text-white shadow-sm"
                                          : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      }`}
                                      title="Approve"
                                    >
                                      {updatingDocId === doc.id && (updatingDocAction === "VERIFIED" || (doc.status === "VERIFIED" && updatingDocAction === "PENDING")) ? (
                                        <Icon name="autorenew" size={18} className="animate-spin" />
                                      ) : (
                                        <Icon name="check" size={16} className={doc.status === "VERIFIED" ? "stroke-[3px]" : ""} />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (doc.status === "REJECTED") {
                                          handleDocStatusChange(index, "PENDING");
                                        } else {
                                          setRejectPopoverIndex(rejectPopoverIndex === index ? null : index);
                                          setRejectionReason("");
                                          setIsOtherReason(false);
                                        }
                                      }}
                                      disabled={isAnyDocProcessing}
                                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                        updatingDocId === doc.id && (updatingDocAction === "REJECTED" || (doc.status === "REJECTED" && updatingDocAction === "PENDING"))
                                          ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                                          : doc.status === "REJECTED" || rejectPopoverIndex === index
                                          ? "bg-rose-500 text-white shadow-sm"
                                          : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                      }`}
                                      title="Reject"
                                    >
                                      {updatingDocId === doc.id && (updatingDocAction === "REJECTED" || (doc.status === "REJECTED" && updatingDocAction === "PENDING")) ? (
                                        <Icon name="autorenew" size={18} className="animate-spin" />
                                      ) : (
                                        <Icon name="close" size={16} className={doc.status === "REJECTED" ? "stroke-[3px]" : ""} />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Premium Silicon Valley Style Rejection Drawer */}
                              <div className={`grid transition-all duration-300 ease-in-out ${rejectPopoverIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                  <div className="p-4 bg-slate-50/80 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 backdrop-blur-sm">
                                    <div className="flex flex-col gap-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Select Rejection Reason</span>
                                        </div>
                                        <button 
                                          onClick={() => setRejectPopoverIndex(null)} 
                                          className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                          <Icon name="close" size={14} />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-4 gap-2">
                                        {REJECTION_REASONS.map((reason, rIndex) => {
                                          const isOther = reason.label === "Other / Custom";
                                          if (isOther) return null; // Handle separately below
                                          return (
                                            <button
                                              key={rIndex}
                                              type="button"
                                              onClick={() => { handleDocStatusChange(index, "REJECTED", reason.label); }}
                                              disabled={isAnyDocProcessing}
                                              className={`group flex flex-col items-center justify-start p-3 rounded-xl border transition-all ${
                                                doc.remarks === reason.label
                                                  ? "bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 ring-2 ring-rose-500/20"
                                                  : "bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/50 dark:bg-zinc-800/80 dark:border-zinc-700 dark:hover:border-rose-500/50 dark:hover:bg-rose-900/20"
                                              }`}
                                            >
                                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${
                                                doc.remarks === reason.label
                                                  ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                                                  : "bg-slate-100 text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600 dark:bg-zinc-700/50 dark:text-zinc-400 dark:group-hover:bg-rose-500/20 dark:group-hover:text-rose-400"
                                              }`}>
                                                {updatingDocId === doc.id && updatingDocAction === "REJECTED" && updatingDocRemarks === reason.label ? (
                                                  <Icon name="sync" size={16} className="animate-spin" />
                                                ) : (
                                                  <Icon name={reason.icon} size={16} />
                                                )}
                                              </div>
                                              <span className={`text-[10px] font-bold text-center leading-tight ${
                                                doc.remarks === reason.label ? "text-rose-700 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"
                                              }`}>{reason.label}</span>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <div className="flex gap-2 items-stretch mt-1">
                                        <button 
                                          onClick={() => { setRejectionReason(""); setIsOtherReason(true); }} 
                                          className={`flex-shrink-0 px-4 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                            isOtherReason 
                                              ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400 shadow-sm" 
                                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-slate-300"
                                          }`}
                                        >
                                          <Icon name="edit_note" size={16} />
                                          Other
                                        </button>
                                        
                                        {isOtherReason && (
                                          <div className="flex-1 flex gap-2">
                                            <input 
                                              type="text" 
                                              value={rejectionReason} 
                                              onChange={(e) => setRejectionReason(e.target.value)}
                                              onKeyDown={(e) => { if(e.key === 'Enter' && rejectionReason.trim() && updatingDocId !== doc.id) { handleDocStatusChange(index, "REJECTED", rejectionReason.trim()); } }}
                                              placeholder="Type specific reason..." 
                                              className="flex-1 h-full min-h-[36px] px-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 shadow-inner" 
                                              autoFocus 
                                            />
                                            <button
                                              disabled={!rejectionReason.trim() || (updatingDocId === doc.id && updatingDocAction === "REJECTED")}
                                              onClick={() => { handleDocStatusChange(index, "REJECTED", rejectionReason.trim()); }}
                                              className="flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all duration-200 disabled:opacity-50"
                                            >
                                              {updatingDocId === doc.id && updatingDocAction === "REJECTED" && updatingDocRemarks === rejectionReason.trim() ? (
                                                <Icon name="sync" size={14} className="animate-spin" />
                                              ) : (
                                                <span>Confirm</span>
                                              )}
                                              <Icon name="arrow_forward" size={14} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SMART UPLOAD SECTION */}
                  {(() => {
                    if (availableDocTypes.length === 0) {
                      return (
                        <div className="mt-4 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-2">
                          <Icon name="check_circle" size={16} />
                          <span>All required documents are uploaded.</span>
                        </div>
                      );
                    }

                    return (
                      <div className="pt-3 mt-1 border-t border-slate-100 dark:border-zinc-800/50 flex flex-col sm:flex-row items-center gap-2">
                        <div className="flex-1 w-full">
                          <Select
                            value={selectedDocType}
                            onValueChange={(val) => setSelectedDocType(val)}
                          >
                            <SelectTrigger className="w-full h-9 px-3 text-xs rounded-lg border-dashed border-slate-300 dark:border-zinc-700 bg-transparent text-slate-500 dark:text-zinc-400 font-medium hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors focus:ring-0">
                              <SelectValue placeholder="+ Add missing document..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900 p-1">
                              {availableDocTypes.map((type) => {
                                const meta = DOCUMENT_META[type] || { label: type, badgeText: "" };
                                return (
                                  <SelectItem key={type} value={type} className="rounded-lg text-xs py-2 cursor-pointer focus:bg-slate-100 dark:focus:bg-zinc-800">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        meta.badge === "MANDATORY" ? "bg-rose-500" : meta.badge === "CONDITIONAL" ? "bg-amber-500" : "bg-emerald-500"
                                      }`} />
                                      <span className="font-semibold text-slate-700 dark:text-zinc-300">{meta.label}</span>
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
                        <input
                          type="file"
                          ref={scanInputRef}
                          onChange={handleScanUpload}
                          className="hidden"
                          accept="image/*,.pdf"
                        />
                        <input
                          type="file"
                          ref={replaceInputRef}
                          onChange={handleReplaceUpload}
                          className="hidden"
                          accept="image/*,.pdf"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleMarkHardcopy}
                            disabled={uploadingDoc || markingHardcopy || !selectedDocType}
                            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-[11px] font-bold flex items-center justify-center transition-all disabled:opacity-30 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800"
                            title="Mark as physically received (No file needed)"
                          >
                            {markingHardcopy ? <Icon name="sync" size={14} className="mr-1.5 animate-spin text-amber-500" /> : <Icon name="folder_special" size={14} className="mr-1.5 text-amber-500" />}
                            {markingHardcopy ? "Saving..." : "Hardcopy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingDoc || markingHardcopy || !selectedDocType}
                            className="h-9 px-4 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center transition-all disabled:opacity-30 shadow-sm cursor-pointer hover:bg-slate-800 dark:hover:bg-zinc-200"
                          >
                            {uploadingDoc ? <Icon name="sync" size={14} className="animate-spin" /> : <Icon name="upload" size={14} className="mr-1.5" />}
                            {uploadingDoc ? "Uploading" : "Upload"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* RIGHT COLUMN: Action & Decision Panel (40% width) */}
                <div className="lg:col-span-5 space-y-4 bg-white dark:bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-slate-200/40 dark:border-zinc-800/40 shadow-sm flex flex-col">
                  <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2 border-b pb-3 mb-2 border-slate-100 dark:border-zinc-800/80">
                    <Icon name="gavel" size={18} className="text-primary" />
                    Verification Decision
                  </h3>

                  <div className="space-y-3 flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Next Stage Transition
                    </label>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setVerifyForm((prev: any) => ({ ...prev, nextStatus: "DOCUMENT_VERIFICATION" }))}
                        disabled={isAnyDocProcessing}
                        className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed ${
                          verifyForm.nextStatus === "DOCUMENT_VERIFICATION"
                            ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-zinc-950 shadow-md ring-2 ring-slate-900/20 dark:ring-white/20"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-[13px] flex items-center gap-1.5">
                            Hold
                          </div>
                          <div className={`text-[11px] mt-0.5 ${verifyForm.nextStatus === "DOCUMENT_VERIFICATION" ? "text-slate-300 dark:text-zinc-500" : "text-slate-500 dark:text-zinc-500"}`}>Keep at Doc Verification</div>
                        </div>
                        {verifyForm.nextStatus === "DOCUMENT_VERIFICATION" && <Icon name="check_circle" size={18} />}
                      </button>

                      {hasEntranceTest && (
                        <button
                          type="button"
                          onClick={() => setVerifyForm((prev: any) => ({ ...prev, nextStatus: "TEST_SCHEDULED" }))}
                          disabled={isAnyDocProcessing}
                          className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed ${
                            verifyForm.nextStatus === "TEST_SCHEDULED"
                              ? "bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20 ring-2 ring-purple-500/20"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                          }`}
                        >
                          <div>
                            <div className="font-bold text-[13px] flex items-center gap-1.5">
                              Entrance Exam
                            </div>
                            <div className={`text-[11px] mt-0.5 ${verifyForm.nextStatus === "TEST_SCHEDULED" ? "text-purple-200" : "text-slate-500 dark:text-zinc-500"}`}>Approve for test</div>
                          </div>
                          {verifyForm.nextStatus === "TEST_SCHEDULED" && <Icon name="check_circle" size={18} />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setVerifyForm((prev: any) => ({ ...prev, nextStatus: "SHORTLISTED" }))}
                        disabled={isAnyDocProcessing}
                        className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed ${
                          verifyForm.nextStatus === "SHORTLISTED"
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-[13px] flex items-center gap-1.5">
                            Direct Shortlist
                          </div>
                          <div className={`text-[11px] mt-0.5 ${verifyForm.nextStatus === "SHORTLISTED" ? "text-emerald-200" : "text-slate-500 dark:text-zinc-500"}`}>Ready to Promote</div>
                        </div>
                        {verifyForm.nextStatus === "SHORTLISTED" && <Icon name="check_circle" size={18} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerifyForm((prev: any) => ({ ...prev, nextStatus: "REJECTED" }))}
                        disabled={isAnyDocProcessing}
                        className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed ${
                          verifyForm.nextStatus === "REJECTED"
                            ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/50"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-[13px] flex items-center gap-1.5">
                            Reject
                          </div>
                          <div className={`text-[11px] mt-0.5 ${verifyForm.nextStatus === "REJECTED" ? "text-rose-200" : "text-slate-500 dark:text-zinc-500"}`}>Move to archives</div>
                        </div>
                        {verifyForm.nextStatus === "REJECTED" && <Icon name="check_circle" size={18} />}
                      </button>
                    </div>

                    {verifyForm.nextStatus === "REJECTED" && (
                      <div className="flex flex-col gap-1.5 pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                          <Icon name="error" size={12} /> Rejection Reason <span className="text-rose-400">*</span>
                        </span>
                        <textarea
                          rows={2}
                          required
                          autoFocus
                          value={verifyForm.archiveReason || ""}
                          onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, archiveReason: e.target.value }))}
                          placeholder="Specify why the applicant is being rejected..."
                          className="w-full p-3 rounded-xl text-[13px] border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-rose-900 dark:text-rose-100 transition-all resize-none font-medium placeholder:text-rose-300 dark:placeholder:text-rose-800/50"
                        />
                      </div>
                    )}

                    {(verifyForm.nextStatus === "SHORTLISTED" || verifyForm.nextStatus === "TEST_SCHEDULED") && !hasAllMandatoryDocs && (
                      <div className="flex flex-col gap-3 pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20">
                          <div className="flex items-start gap-2">
                            <Icon name="warning" size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-amber-800 dark:text-amber-500">Missing Mandatory Documents</span>
                              <span className="text-[11px] font-medium text-amber-700/80 dark:text-amber-600/80 leading-relaxed">
                                You cannot shortlist this applicant because mandatory documents are pending.
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-900/30">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${verifyForm.isProvisional ? 'bg-amber-500' : 'bg-slate-200 dark:bg-zinc-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${verifyForm.isProvisional ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={verifyForm.isProvisional || false}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setVerifyForm((prev: any) => ({
                                    ...prev,
                                    isProvisional: isChecked,
                                    overrideReason: isChecked ? prev.overrideReason : "",
                                    provisionalDeadline: isChecked ? prev.provisionalDeadline : ""
                                  }));
                                }}
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-zinc-100 transition-colors">
                                Allow Provisional Admission (Bypass)
                              </span>
                            </label>
                          </div>
                        </div>

                        {verifyForm.isProvisional && (
                          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                                <Icon name="edit_note" size={12} /> Override Reason <span className="text-amber-500">*</span>
                              </span>
                              <textarea
                                rows={2}
                                required={verifyForm.isProvisional}
                                autoFocus
                                value={verifyForm.overrideReason || ""}
                                onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, overrideReason: e.target.value }))}
                                placeholder="Why is this being bypassed? (e.g. Principal approved...)"
                                className="w-full p-3 rounded-xl text-[13px] border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-amber-900 dark:text-amber-100 transition-all resize-none font-medium placeholder:text-amber-700/40 dark:placeholder:text-amber-600/40"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                                <Icon name="event" size={12} /> Submission Deadline <span className="text-amber-500">*</span>
                              </span>
                              <input
                                type="date"
                                required={verifyForm.isProvisional}
                                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                                value={verifyForm.provisionalDeadline || ""}
                                onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, provisionalDeadline: e.target.value }))}
                                className="w-full p-3 rounded-xl text-[13px] border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-amber-900 dark:text-amber-100 transition-all font-medium"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 pt-4 mt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Verification Notes
                      </span>
                      <textarea
                        rows={2}
                        value={verifyForm.verificationNotes}
                        onChange={(e) => setVerifyForm((prev: any) => ({ ...prev, verificationNotes: e.target.value }))}
                        placeholder="Optional remarks, internal notes..."
                        className="w-full p-3 rounded-xl text-[13px] border border-slate-200/60 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white dark:focus:bg-zinc-900 text-slate-800 dark:text-zinc-200 transition-all resize-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                    <div className="pt-2 mt-auto">
                      {formError && (
                        <div className="mb-3 p-3 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/80 dark:bg-red-950/20 text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in">
                          <Icon name="warning" size={16} className="text-red-500 shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={
                          actionLoading || 
                          isAnyDocProcessing || 
                          ((verifyForm.nextStatus === "SHORTLISTED" || verifyForm.nextStatus === "TEST_SCHEDULED") && !hasAllMandatoryDocs && !verifyForm.isProvisional) ||
                          (verifyForm.isProvisional && (!verifyForm.provisionalReason?.trim() || !verifyForm.provisionalDeadline)) ||
                          (verifyForm.nextStatus === "REJECTED" && !verifyForm.archiveReason?.trim())
                        }
                        className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl h-11 font-bold shadow-md shadow-slate-900/10 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? <Icon name="sync" size={16} className="animate-spin" /> : <Icon name="check_circle" size={16} />}
                        {actionLoading ? "Saving..." : "Confirm Decision"}
                      </button>
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Test Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={examForm.examDate}
                      onChange={(e) => handleExamChange("examDate", e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
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
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
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
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                      Exam Verdict / Status <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={examForm.verdict}
                      onValueChange={(val: any) => handleExamChange("verdict", val)}
                    >
                      <SelectTrigger fullWidth className="h-10 rounded-xl border-slate-200 dark:border-zinc-800 text-sm font-semibold">
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
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
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
              <form onSubmit={onPromote} className="space-y-4 animate-in fade-in duration-300">
                {/* 1. Academic Placement Settings - Ultra Compact (Removed Section & Roll No) */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-zinc-400 flex items-center gap-2">
                    <Icon name="school" size={16} className="text-emerald-500" />
                    ACADEMIC PLACEMENT
                  </h4>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Admission Date
                    </label>
                    <input
                      type="date"
                      required
                      value={promoteForm.admissionDate}
                      onChange={(e) => handlePromoteChange("admissionDate", e.target.value)}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* 2-Column Split: Fee Receipt & Installments */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  
                  {/* LEFT CARD: FEE RECEIPT */}
                  <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="bg-slate-50/50 dark:bg-zinc-900/50 px-4 py-2 border-b border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
                      <h4 className="text-[11px] font-black tracking-wider text-slate-800 dark:text-zinc-100 uppercase">
                        FEE ESTIMATE
                      </h4>
                      {/* Compact Term Type */}
                      <select
                        value={promoteForm.termType}
                        onChange={(e) => handlePromoteChange("termType", e.target.value)}
                        className="h-7 px-2 text-[10px] font-bold rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 outline-none"
                      >
                        <option value="FULL_TERM">Annual</option>
                        <option value="HALF_TERM">Half Term</option>
                        <option value="SHORT_TERM">Short Term</option>
                      </select>
                    </div>

                    <div className="p-3 space-y-4">

                      {/* Mandatory Fees */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                          Mandatory Fees
                        </div>
                        <div className="space-y-1 pl-1">
                          {classFees.length > 0 ? classFees.filter(f => f.applicability === "MANDATORY").map((fee) => (
                            <div key={fee.id} className="flex justify-between text-[11px] text-slate-600 dark:text-zinc-400">
                              <span>{fee.name}</span>
                              <span className="font-semibold text-slate-700 dark:text-zinc-300">₹{formatIndianNumber(Number(fee.amount))}</span>
                            </div>
                          )) : <div className="text-[11px] text-slate-400 italic">No mandatory fees.</div>}
                        </div>
                        {/* Subtotal Mandatory */}
                        <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t border-dashed border-slate-200 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 pl-1">Subtotal (Mandatory)</span>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">₹{formatIndianNumber(mandatoryTotal)}</span>
                        </div>
                      </div>

                      {/* Optional Add-ons */}
                      <div className="space-y-1.5 pt-3 border-t-2 border-slate-100 dark:border-zinc-800">
                        <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                          Optional Add-ons
                        </div>
                        <div className="space-y-1 pl-1">
                          {classFees.filter(f => f.applicability === "OPTIONAL").map((fee) => {
                            const selectedFee = selectedOptionalFees.find(opt => opt.id === fee.id);
                            return (
                              <div key={fee.id} className="flex items-center justify-between text-[11px] py-1 rounded-md transition-colors">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
                                  <input type="checkbox" checked={!!selectedFee} onChange={(e) => handleOptionalFeeToggle(fee, e.target.checked)} className="rounded text-primary w-3.5 h-3.5" />
                                  <span>{fee.name}</span>
                                </label>
                                {selectedFee ? (
                                  <div className="flex items-center gap-1 w-20">
                                    <span className="text-[10px] text-slate-400">₹</span>
                                    <input type="number" min={0} value={selectedFee.amount || ""} onChange={(e) => handleOptionalFeeAmountChange(fee.id, Number(e.target.value))} className="w-full h-6 px-1.5 rounded border border-amber-200 text-xs font-bold text-right outline-none focus:border-amber-400" />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 dark:text-zinc-600 line-through">₹{formatIndianNumber(fee.amount)}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Subtotal Optional */}
                        <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t border-dashed border-slate-200 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 pl-1">Subtotal (Optional)</span>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">₹{formatIndianNumber(optionalTotal)}</span>
                        </div>
                      </div>

                      {/* Gross Total & Discount */}
                      <div className="pt-3 border-t-4 border-double border-slate-200 dark:border-zinc-800 space-y-2.5">
                        {/* Gross Total */}
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-black uppercase text-slate-800 dark:text-zinc-200 tracking-wider">Gross Total</span>
                          <span className="text-[13px] font-black text-slate-800 dark:text-zinc-200">₹{formatIndianNumber(mandatoryTotal + optionalTotal)}</span>
                        </div>

                        {/* Flat Discount */}
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                            Discount
                          </label>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1.5 text-[10px] font-bold text-emerald-500/80 dark:text-emerald-400/80">- ₹</span>
                            <input 
                              type="number" 
                              value={String(promoteForm.discountAmount)} 
                              onChange={(e) => handlePromoteChange("discountAmount", e.target.value)} 
                              className="w-full h-7 pl-7 pr-2 rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-[11px] font-bold text-right text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 transition-all shadow-sm" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 mt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5 rounded-lg shadow-inner mx-0.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-black tracking-wider text-emerald-800 dark:text-emerald-400 uppercase">NET FEE</span>
                          <span className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-500/70 uppercase">Applicable Amount</span>
                        </div>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹{formatIndianNumber(totalDiscountedFee)}</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT CARD: INSTALLMENTS (Silicon Valley Data-Table Style) */}
                  <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 shadow-sm flex flex-col h-full">
                    <div className="bg-slate-50/50 dark:bg-zinc-900/50 px-4 py-2 border-b border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Icon name="calendar_month" size={14} className="text-indigo-500" />
                        INSTALLMENT SCHEDULE
                      </h4>
                      <div className="flex items-center gap-3">
                        {/* Compact Toggle */}
                        <div className="flex p-0.5 bg-slate-200/50 dark:bg-zinc-800/50 rounded-md border border-slate-200/60 dark:border-zinc-700 h-6">
                          <button
                            type="button"
                            onClick={() => {
                              if (billingMode !== "STANDARD") {
                                setCachedCustomInstallments([...(customInstallments || [])]);
                                setBillingMode?.("STANDARD");
                                if (setCustomInstallments && installmentTemplates) {
                                  setCustomInstallments(
                                    installmentTemplates.map((t: any) => ({
                                      id: `template-${t.id}`,
                                      templateId: t.id,
                                      name: t.name,
                                      dueDate: t.dueDate,
                                      amount: Number(t.amount) || 0,
                                      checked: true,
                                      isCustom: false,
                                    }))
                                  );
                                }
                              }
                            }}
                            className={`px-3 flex items-center justify-center text-[9px] font-extrabold rounded-sm transition-all ${
                              billingMode === "STANDARD" ? "bg-white dark:bg-zinc-900 text-slate-800 shadow-sm" : "text-slate-500"
                            }`}
                          >
                            STANDARD
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (billingMode !== "CUSTOM") {
                                setBillingMode?.("CUSTOM");
                                if (setCustomInstallments && cachedCustomInstallments.length > 0) {
                                  setCustomInstallments(cachedCustomInstallments);
                                }
                              }
                            }}
                            className={`px-3 flex items-center justify-center text-[9px] font-extrabold rounded-sm transition-all ${
                              billingMode === "CUSTOM" ? "bg-white dark:bg-zinc-900 text-slate-800 shadow-sm" : "text-slate-500"
                            }`}
                          >
                            CUSTOM
                          </button>
                        </div>
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          {customInstallments.filter(i => i.checked).length} Active
                        </span>
                      </div>
                    </div>

                    {billingMode === "CUSTOM" && (
                      <div className="shrink-0 border-b border-slate-200/60 dark:border-zinc-800 p-2 bg-slate-50/80 dark:bg-zinc-900/40 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-5 shrink-0 pl-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 shrink-0">Rows</span>
                            <input
                              type="number"
                              min={1} max={24}
                              value={customConfigRows}
                              onChange={(e) => setCustomConfigRows?.(Number(e.target.value) || 1)}
                              className="h-8 w-14 px-2 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-bold outline-none focus:border-indigo-400 text-center shadow-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 shrink-0">Start</span>
                            <input
                              type="date"
                              value={customConfigStartDate}
                              onChange={(e) => setCustomConfigStartDate?.(e.target.value)}
                              className="h-8 w-[115px] px-2 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-bold outline-none focus:border-indigo-400 shadow-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 shrink-0">Interval</span>
                            <div className="w-[115px]">
                              <Select value={customConfigInterval} onValueChange={(val: any) => setCustomConfigInterval?.(val)}>
                                <SelectTrigger className="h-8 px-2.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-[10px] font-bold shadow-sm focus:ring-1 focus:ring-indigo-400">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MONTHLY" className="text-[10px] font-semibold">Monthly</SelectItem>
                                  <SelectItem value="BIMONTHLY" className="text-[10px] font-semibold">Bi-Monthly</SelectItem>
                                  <SelectItem value="QUARTERLY" className="text-[10px] font-semibold">Quarterly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 px-2">
                            <input
                              id="inline-late-fee"
                              type="checkbox"
                              checked={customConfigLateFee}
                              onChange={(e) => setCustomConfigLateFee?.(e.target.checked)}
                              className="rounded-sm w-4 h-4 text-indigo-500 border-slate-300 dark:border-zinc-700 focus:ring-indigo-500/20 cursor-pointer shadow-sm"
                            />
                            <label htmlFor="inline-late-fee" className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 cursor-pointer select-none">Late Fee</label>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={generateCustomInstallments}
                          className="shrink-0 h-8 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md text-[10px] font-black tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/10"
                        >
                          <Icon name="bolt" size={12} />
                          Generate
                        </button>
                      </div>
                    )}

                    <div className="p-2 flex-1 space-y-1 overflow-y-auto max-h-[350px]">
                      {customInstallments.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-xs font-semibold">No installments configured.</div>
                      ) : (
                        customInstallments.map((inst, index) => {
                          const template = installmentTemplates.find(t => t.id === inst.templateId);
                          return (
                            <div key={inst.templateId || index} className="flex items-center gap-3 p-2 rounded-xl transition-all border bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 shadow-sm">
                              
                              <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 ml-1">
                                <span className="text-[10px] font-black text-slate-500 dark:text-zinc-400">{index + 1}</span>
                              </div>

                              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 ml-1">
                                <span className="text-xs font-bold truncate min-w-[120px] text-slate-800 dark:text-zinc-200">
                                  {template?.name || inst.name || `Inst. ${index + 1}`}
                                </span>
                                {inst.isCustom ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-400 font-medium">Due: </span>
                                    <input
                                      type="date"
                                      min={new Date().toISOString().split("T")[0]}
                                      value={inst.dueDate ? inst.dueDate.split("T")[0] : ""}
                                      onChange={(e) => handleInstallmentDateChange(inst.id, e.target.value)}
                                      className="h-6 px-1.5 rounded-md border border-slate-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 cursor-pointer transition-all"
                                      title="Edit Due Date"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Due: {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "TBD"}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 mr-1">
                                <span className="text-xs text-slate-400 font-bold">₹</span>
                                <BaseCurrencyInput
                                  disabled={!inst.checked || billingMode === "STANDARD"}
                                  value={String(inst.amount)}
                                  onChange={(e) => handleInstallmentAmountChange(inst.templateId || inst.id || String(index), Number(e.target.value) || 0)}
                                  className={`w-24 h-8 text-xs font-bold rounded-lg border px-2 text-right outline-none transition-all ${
                                    billingMode === "STANDARD" 
                                      ? "bg-slate-50 dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 cursor-not-allowed" 
                                      : "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 text-slate-800 dark:text-zinc-100"
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Sticky Footer Action Bar (Live Balance & Enroll) */}
                <div className="sticky bottom-0 mt-4 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl shadow-xl shadow-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
                  {/* Left: Payment Info */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400">Upfront Amount</label>
                      <BaseCurrencyInput value={String(promoteForm.amountPaid)} onChange={(e) => handlePromoteChange("amountPaid", e.target.value)} placeholder="₹ 0" className="w-24 h-8 px-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-primary bg-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400">Method</label>
                      <Select value={promoteForm.paymentMethod} onValueChange={(val: any) => handlePromoteChange("paymentMethod", val)}>
                        <SelectTrigger className="w-28 h-8 rounded-lg border-slate-200 text-xs font-semibold bg-white"><SelectValue placeholder="Method" /></SelectTrigger>
                        <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="ONLINE">Online</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem><SelectItem value="BANK_TRANSFER">Bank</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-400">Ref ID</label>
                      <input type="text" value={promoteForm.transactionId} onChange={(e) => handlePromoteChange("transactionId", e.target.value)} placeholder="TXN..." className="w-28 h-8 px-2 rounded-lg border border-slate-200 text-xs font-semibold outline-none focus:border-primary bg-white" />
                    </div>
                  </div>

                  {/* Right: Balance Tracker & Submit */}
                  <div className="flex items-center gap-4 shrink-0">
                    {(() => {
                      const allocatedSum = customInstallments.filter(i => i.checked).reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
                      const shortfall = totalDiscountedFee - allocatedSum;
                      return (
                        <div className={`flex flex-col items-end mr-2 ${shortfall !== 0 ? "text-rose-500" : "text-emerald-600"}`}>
                          <span className="text-[10px] font-extrabold uppercase">
                            {shortfall > 0 ? "Shortfall" : shortfall < 0 ? "Over-allocated" : "Balance Matched"}
                          </span>
                          <span className="text-sm font-black">
                            {shortfall !== 0 ? `₹${formatIndianNumber(Math.abs(shortfall))}` : "✓ Perfect"}
                          </span>
                        </div>
                      );
                    })()}
                    <button
                      type="submit"
                      disabled={
                        actionLoading || 
                        (customInstallments.filter(i => i.checked).reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) !== totalDiscountedFee)
                      }
                      className="h-10 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 text-white text-sm font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
                    >
                      {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="check_circle" size={18} />}
                      ENROLL STUDENT
                    </button>
                  </div>
                </div>

                {formError && (
                  <div className="p-4 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/10 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2.5">
                    <Icon name="warning" size={16} className="text-red-500 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </form>
            )}




            {/* STATUS: REJECTED */}
            {selectedApp.status === "REJECTED" && (
              <div className="py-10 text-center space-y-6">
                <span className="inline-flex items-center justify-center p-4 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200/50 shadow-sm">
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
                <span className="inline-flex items-center justify-center p-4 rounded-full bg-slate-50 dark:bg-zinc-800/60 text-slate-500 border border-slate-100 dark:border-zinc-800 shadow-sm">
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
      </div>
      )}

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="max-w-[400px] rounded-3xl bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.08)] focus:outline-none">
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
        <DialogContent className="max-w-[380px] rounded-3xl bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800 shadow-2xl focus:outline-none">
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

      <DocumentPreviewDialog 
        open={!!previewDoc} 
        onOpenChange={(open) => !open && setPreviewDoc(null)} 
        document={previewDoc} 
        onReplaceClick={() => {
          if (previewDoc) {
            setReplaceDocType(previewDoc.documentType);
            setTimeout(() => replaceInputRef.current?.click(), 50);
          }
        }}
        isReplacing={isReplacingDocType === previewDoc?.documentType}
      />
    </div>
  );
}
