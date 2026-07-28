"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { BaseCurrencyInput } from "@/components/ui/base-currency-input";

interface ClassItem {
  id: string;
  name: string;
}

interface InquiryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassItem[];
  inquiryForm: {
    studentName: string;
    dateOfBirth: string;
    gender: string;
    classAppliedId: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    source: string;
    notes: string;
  };
  setInquiryForm: (val: any) => void;
  onSubmit: (e: React.FormEvent, force?: boolean) => Promise<any> | void;
  loading: boolean;
  branchId: string;
  academicYearId: string;
  onSuccess?: () => void;
}

export default function InquiryModal({
  open,
  onOpenChange,
  classes,
  inquiryForm,
  setInquiryForm,
  onSubmit,
  loading,
  branchId,
  academicYearId,
  onSuccess,
}: InquiryModalProps) {
  const snackbar = useSnackbar();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [expressAdmit, setExpressAdmit] = useState(false);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [expressForm, setExpressForm] = useState({
    sectionId: "",
    rollNo: "",
    discountAmount: 0,
    amountPaid: 0,
    paymentMethod: "CASH",
    transactionId: "",
    bypassAgeLimit: false,
  });
  const [expressAdmitting, setExpressAdmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const isFormDirty = () => {
    return (
      inquiryForm.studentName !== "" ||
      inquiryForm.dateOfBirth !== "" ||
      inquiryForm.gender !== "MALE" ||
      inquiryForm.classAppliedId !== "" ||
      inquiryForm.parentName !== "" ||
      inquiryForm.parentPhone !== "" ||
      inquiryForm.parentEmail !== "" ||
      inquiryForm.source !== "WALK_IN" ||
      inquiryForm.notes !== "" ||
      (expressAdmit && (
        expressForm.rollNo !== "" ||
        Number(expressForm.discountAmount) !== 0 ||
        Number(expressForm.amountPaid) !== 0
      ))
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (isFormDirty()) {
        setShowDiscardConfirm(true);
      } else {
        onOpenChange(false);
      }
    } else {
      onOpenChange(true);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setInquiryForm({
      studentName: "",
      dateOfBirth: "",
      gender: "MALE",
      classAppliedId: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      source: "WALK_IN",
      notes: "",
    });
    setExpressForm({
      sectionId: "",
      rollNo: "",
      discountAmount: 0,
      amountPaid: 0,
      paymentMethod: "CASH",
      transactionId: "",
      bypassAgeLimit: false,
    });
    setExpressAdmit(false);
    onOpenChange(false);
  };

  useEffect(() => {
    if (inquiryForm.classAppliedId) {
      setSectionsLoading(true);
      fetch(`/api/v1/classes/${inquiryForm.classAppliedId}/sections`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSections(data.data);
            if (data.data.length > 0) {
              setExpressForm((prev) => ({ ...prev, sectionId: data.data[0].id }));
            } else {
              setExpressForm((prev) => ({ ...prev, sectionId: "" }));
            }
          }
        })
        .catch((err) => console.error("Error loading sections:", err))
        .finally(() => setSectionsLoading(false));
    }
  }, [inquiryForm.classAppliedId]);

  useEffect(() => {
    if (!open) {
      setErrors({});
      setDuplicateWarning(null);
    }
  }, [open]);

  const handleChange = (field: string, value: string) => {
    setDuplicateWarning(null);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setInquiryForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleExpressFieldChange = (field: string, value: any) => {
    setDuplicateWarning(null);
    setExpressForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    setErrors({});
    setDuplicateWarning(null);
    
    if (!expressAdmit) {
      const result = await onSubmit(e, force);
      if (result && !result.success && result.error) {
        if (result.error.code === "VALIDATION_ERROR" && result.error.details) {
          const newErrors: Record<string, string> = {};
          result.error.details.forEach((err: any) => {
            newErrors[err.field] = err.message;
          });
          setErrors(newErrors);
        } else if (result.error.code === "DUPLICATE_INQUIRY") {
          setDuplicateWarning(result.error.message);
          snackbar.show(result.error.message, "warning");
        }
      }
      return;
    }

    if (!expressForm.sectionId) {
      snackbar.show("Please select a section for direct intake.", "error");
      return;
    }

    const discount = Number(expressForm.discountAmount) || 0;
    if (discount < 0 || discount > 100) {
      snackbar.show("Discount percent must be between 0% and 100%.", "error");
      return;
    }

    const amountPaidVal = Number(expressForm.amountPaid) || 0;
    if (amountPaidVal < 0) {
      snackbar.show("Amount paid cannot be negative.", "error");
      return;
    }

    if (amountPaidVal > 0 && !expressForm.paymentMethod) {
      snackbar.show("Please select a payment mode for the upfront payment.", "error");
      return;
    }

    setExpressAdmitting(true);
    try {
      const payload = {
        ...inquiryForm,
        ...expressForm,
        branchId,
        academicYearId,
      };

      const url = force 
        ? "/api/v1/admissions/inquiries/express-create?force=true" 
        : "/api/v1/admissions/inquiries/express-create";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        snackbar.show("Inquiry logged and student admitted successfully!", "success");
        if (onSuccess) onSuccess();
      } else {
        if (data.error?.code === "VALIDATION_ERROR" && data.error.details) {
          const newErrors: Record<string, string> = {};
          data.error.details.forEach((err: any) => {
            newErrors[err.field] = err.message;
          });
          setErrors(newErrors);
          snackbar.show("Validation failed. Please check highlighted errors.", "error");
        } else if (data.error?.code === "DUPLICATE_INQUIRY") {
          setDuplicateWarning(data.error?.message);
          snackbar.show(data.error?.message, "warning");
        } else {
          snackbar.show(data.error?.message || "Failed to direct admit student.", "error");
        }
      }
    } catch (err) {
      console.error(err);
      snackbar.show("Network error during direct admission.", "error");
    } finally {
      setExpressAdmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        overlayClassName="fixed left-0 md:left-20 xl:left-[280px] top-20 right-0 bottom-0 inset-auto bg-transparent backdrop-blur-none"
        className="fixed left-0 md:left-20 xl:left-[280px] top-20 right-0 bottom-0 w-auto h-auto max-w-none max-h-none translate-x-0 translate-y-0 rounded-none bg-white dark:bg-zinc-900 border-0 shadow-none flex flex-col p-6 md:p-10 md:py-12 overflow-hidden"
      >
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full overflow-hidden min-h-0">
          <div className="flex justify-between items-start mb-6 border-b border-slate-100/80 dark:border-zinc-800/80 pb-5 shrink-0 pr-12">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
                New Counselor Inquiry
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">
                Log prospective lead inquiries from walk-ins, phone calls, or digital referrals.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => {
                if (classes.length > 0) {
                  setInquiryForm({
                    studentName: "Omkar Ranade",
                    dateOfBirth: "2016-05-14",
                    gender: "MALE",
                    classAppliedId: classes[0].id,
                    parentName: "Vijay Ranade",
                    parentPhone: "9876543211",
                    parentEmail: "vijay.ranade@example.com",
                    source: "WALK_IN",
                    notes: "Looking for immediate admission. Good academic record.",
                  });
                  snackbar.show("Demo inquiry data filled!", "success");
                } else {
                  snackbar.show("No classes found to pre-fill.", "warning");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-all shrink-0"
            >
              <Icon name="sparkles" size={14} />
              Autofill
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto pr-1 space-y-7 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Student Name */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.studentName ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Student Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryForm.studentName}
                    onChange={(e) => handleChange("studentName", e.target.value)}
                    placeholder="e.g. Aditya Kulkarni"
                    className={`w-full h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                      errors.studentName 
                        ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                        : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                    }`}
                  />
                  {errors.studentName && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.studentName}
                    </p>
                  )}
                </div>

                {/* Class Applied */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.classAppliedId ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Class Applied <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={inquiryForm.classAppliedId}
                    onValueChange={(val) => handleChange("classAppliedId", val)}
                  >
                    <SelectTrigger 
                      fullWidth 
                      className={`h-[52px] px-5 rounded-2xl bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                        errors.classAppliedId 
                          ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                          : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                      }`}
                    >
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.classAppliedId && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.classAppliedId}
                    </p>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.dateOfBirth ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={inquiryForm.dateOfBirth}
                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                    className={`w-full h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                      errors.dateOfBirth 
                        ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                        : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                    }`}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.dateOfBirth}
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.gender ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={inquiryForm.gender}
                    onValueChange={(val) => handleChange("gender", val)}
                  >
                    <SelectTrigger 
                      fullWidth 
                      className={`h-[52px] px-5 rounded-2xl bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                        errors.gender 
                          ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                          : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                      }`}
                    >
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.gender && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.gender}
                    </p>
                  )}
                </div>

                {/* Parent Name */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.parentName ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Parent / Guardian Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryForm.parentName}
                    onChange={(e) => handleChange("parentName", e.target.value)}
                    placeholder="e.g. Sanjay Kulkarni"
                    className={`w-full h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                      errors.parentName 
                        ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                        : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                    }`}
                  />
                  {errors.parentName && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.parentName}
                    </p>
                  )}
                </div>

                {/* Parent Phone */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.parentPhone ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Parent Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryForm.parentPhone}
                    onChange={(e) => handleChange("parentPhone", e.target.value)}
                    placeholder="10-digit number"
                    className={`w-full h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                      errors.parentPhone 
                        ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                        : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                    }`}
                  />
                  {errors.parentPhone && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.parentPhone}
                    </p>
                  )}
                </div>

                {/* Parent Email */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.parentEmail ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Parent Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={inquiryForm.parentEmail}
                    onChange={(e) => handleChange("parentEmail", e.target.value)}
                    placeholder="e.g. parent@example.com"
                    className={`w-full h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                      errors.parentEmail 
                        ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                        : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                    }`}
                  />
                  {errors.parentEmail && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.parentEmail}
                    </p>
                  )}
                </div>

                {/* Source */}
                <div className="flex flex-col gap-2 w-full">
                  <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.source ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                    Inquiry Source <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={inquiryForm.source}
                    onValueChange={(val) => handleChange("source", val)}
                  >
                    <SelectTrigger 
                      fullWidth 
                      className={`h-[52px] px-5 rounded-2xl bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                        errors.source 
                          ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                          : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                      }`}
                    >
                      <SelectValue placeholder="Select Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WALK_IN">Walk-in</SelectItem>
                      <SelectItem value="WEBSITE">Website Lead</SelectItem>
                      <SelectItem value="SOCIAL_MEDIA">Social Media</SelectItem>
                      <SelectItem value="REFERRAL">Referral</SelectItem>
                      <SelectItem value="NEWSPAPER">Newspaper</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.source && (
                    <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {errors.source}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2 w-full">
                <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.notes ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                  Intake Conversation Notes
                </label>
                <textarea
                  rows={3}
                  value={inquiryForm.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Log key student details, bus facility requirements, previous syllabus constraints, etc."
                  className={`w-full px-5 py-4 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 resize-none min-h-[100px] ${
                    errors.notes 
                      ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
                      : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                  }`}
                />
                {errors.notes && (
                  <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.notes}
                  </p>
                )}
              </div>

              {/* Direct Admit Toggle Switch */}
              <div className="p-5 md:p-6 rounded-[1.5rem] border border-teal-100 dark:border-teal-950/40 bg-teal-50/10 dark:bg-teal-950/[0.01] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-teal-600 select-none">person_add</span>
                  <div>
                    <p className="text-xs font-extrabold text-slate-800 dark:text-zinc-100">
                      Convert to Active Student Immediately (Direct Enrollment)
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                      Bypasses the multi-stage admission desk and registers the candidate in the student directory.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpressAdmit(!expressAdmit)}
                  className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ${
                    expressAdmit ? "bg-teal-700" : "bg-slate-200 dark:bg-zinc-800"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-all duration-300 ${
                      expressAdmit ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Express Admission Collapsible Fields */}
              {expressAdmit && (
                <div className="p-6 rounded-[1.5rem] border border-teal-100/50 bg-teal-50/5 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400 border-b pb-3 border-slate-100 dark:border-zinc-800">
                    Direct Onboarding Parameters
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    {/* Section */}
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Assign Section *
                      </label>
                      {sectionsLoading ? (
                        <div className="text-xs text-slate-400 animate-pulse py-3">Loading sections...</div>
                      ) : sections.length === 0 ? (
                        <div className="text-xs text-amber-600 font-semibold py-3">No sections found. Please select class applied first.</div>
                      ) : (
                        <Select
                          value={expressForm.sectionId}
                          onValueChange={(val) => handleExpressFieldChange("sectionId", val)}
                        >
                          <SelectTrigger fullWidth className="h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                            <SelectValue placeholder="Select Section" />
                          </SelectTrigger>
                          <SelectContent>
                            {sections.map((sec) => (
                              <SelectItem key={sec.id} value={sec.id}>
                                {sec.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Roll No */}
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Roll Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={expressForm.rollNo}
                        onChange={(e) => handleExpressFieldChange("rollNo", e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>

                    {/* Discount % */}
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Discount Percent (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={expressForm.discountAmount || ""}
                        onChange={(e) => handleExpressFieldChange("discountAmount", Number(e.target.value))}
                        placeholder="e.g. 15%"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>

                    {/* Amount Paid */}
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Amount Paid Upfront (₹)
                      </label>
                      <BaseCurrencyInput
                        value={expressForm.amountPaid || ""}
                        onChange={(e) => handleExpressFieldChange("amountPaid", Number(e.target.value))}
                        placeholder="e.g. 5000"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Payment Mode
                      </label>
                      <Select
                        value={expressForm.paymentMethod}
                        onValueChange={(val) => handleExpressFieldChange("paymentMethod", val)}
                      >
                        <SelectTrigger fullWidth className="h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                          <SelectValue placeholder="Select Mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="ONLINE">Online Portal</SelectItem>
                          <SelectItem value="UPI">UPI / QR Scan</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank NetTransfer</SelectItem>
                          <SelectItem value="CHEQUE">Cheque Clearance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Transaction ID */}
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Transaction ID / Reference
                      </label>
                      <input
                        type="text"
                        value={expressForm.transactionId}
                        onChange={(e) => handleExpressFieldChange("transactionId", e.target.value)}
                        placeholder="e.g. TXN987654"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Checkbox for Age Bypass */}
                  <div className="flex items-center gap-2 pt-1 pl-1">
                    <input
                      type="checkbox"
                      id="bypassAgeLimitModal"
                      checked={expressForm.bypassAgeLimit}
                      onChange={(e) => handleExpressFieldChange("bypassAgeLimit", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <label htmlFor="bypassAgeLimitModal" className="text-xs text-slate-500 font-semibold cursor-pointer select-none">
                      Bypass age validation constraint (Under 3 years old)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Actions */}
            <div className="flex flex-col gap-4 pt-5 border-t border-slate-100 dark:border-zinc-800 shrink-0">
              {duplicateWarning && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                  <div className="flex items-start gap-3">
                    <Icon name="warning" className="text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-800 dark:text-amber-500">Duplicate Candidate Found</h4>
                      <p className="text-xs font-semibold text-amber-700/80 dark:text-amber-400/80 mt-1">{duplicateWarning}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={(e) => handleFormSubmit(e as any, true)}
                    variant="filled"
                    className="bg-amber-500 text-white hover:bg-amber-600 font-bold shadow-lg shadow-amber-500/20"
                    loading={expressAdmit ? expressAdmitting : loading}
                  >
                    Force Proceed
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-2xl h-12 px-6 font-bold text-sm cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="filled"
                  icon={expressAdmit ? "verified" : "save"}
                  loading={expressAdmit ? expressAdmitting : loading}
                  disabled={!!duplicateWarning}
                  className={`rounded-2xl h-12 px-6 font-bold text-sm text-white ${
                    expressAdmit
                      ? "bg-teal-700 hover:bg-teal-800"
                      : "bg-primary hover:bg-primary/95"
                  }`}
                >
                  {expressAdmit ? "Save & Enroll Student" : "Log Inquiry"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
      <DiscardConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
      />
    </>
  );
}
