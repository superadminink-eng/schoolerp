"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { BaseCurrencyInput } from "@/components/ui/base-currency-input";
import { useEffect, useRef, useState } from "react";


interface ClassItem {
  id: string;
  name: string;
}

interface InquiryModalProps {
  onClose: () => void;
  classes: ClassItem[];
  inquiryForm: any;
  setInquiryForm: (val: any) => void;
  handleFormSubmit: (e: React.FormEvent, force?: boolean) => Promise<any> | void;
  loading: boolean;
  branchFilter: string;
  activeAcademicYearId: string;
}

export default function NewInquiryPane({
  onClose,
  classes,
  inquiryForm,
  setInquiryForm,
  handleFormSubmit,
  loading,
  branchFilter,
  activeAcademicYearId,
}: InquiryModalProps) {
  const snackbar = useSnackbar();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the first input after mount
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  }, []);
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

  const handleClose = () => {
    if (inquiryForm.studentName || inquiryForm.parentName || inquiryForm.parentPhone) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
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

  const handleSubmit = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    setErrors({});
    setDuplicateWarning(null);
    
    if (!expressAdmit) {
      const result = await handleFormSubmit(e, force);
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
        branchFilter,
        activeAcademicYearId,
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
        if (onClose) onClose();
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
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-zinc-950/20 overflow-hidden relative">
      {/* Sticky Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0 sticky top-0 z-10">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
            New Counselor Inquiry
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Log a new prospective student inquiry
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (classes.length > 0) {
                setInquiryForm({
                  studentName: "Aditya Kulkarni",
                  dateOfBirth: "2016-05-14",
                  gender: "MALE",
                  classAppliedId: classes[0].id,
                  parentName: "Rahul Kulkarni",
                  parentPhone: "9876543211",
                  parentEmail: "rahul.kulkarni@example.com",
                  source: "WALK_IN",
                  notes: "Looking for immediate admission.",
                });
                snackbar.show("Demo inquiry data filled!", "success");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Icon name="sparkles" size={14} />
            Autofill
          </button>
          
          {duplicateWarning && (
            <Button type="button" onClick={e => handleSubmit(e as any, true)} loading={expressAdmit ? expressAdmitting : loading} className="h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium shadow-sm">
              Force Proceed
            </Button>
          )}
          
          <button
            type="button"
            onClick={handleClose}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[13px] font-medium shadow-sm transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={(e) => {
              // Trigger form submit
              const form = document.getElementById("new-inquiry-form") as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
            disabled={!!duplicateWarning || (expressAdmit ? expressAdmitting : loading)}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-[13px] font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {expressAdmit ? (expressAdmitting ? "Enrolling..." : "Enroll Student") : (loading ? "Saving..." : "Log Inquiry")}
          </button>
        </div>
      </div>

      {/* Form Body - Centered with Max Width */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-track]:bg-transparent">
        <form id="new-inquiry-form" onSubmit={handleSubmit} className="max-w-3xl mx-auto py-8 px-6 space-y-8">
          
          {duplicateWarning && (
            <div className="p-4 bg-amber-50 text-amber-800 text-sm font-medium rounded-lg border border-amber-200 flex items-center gap-3">
              <Icon name="warning" size={18} className="text-amber-500" />
              {duplicateWarning}
            </div>
          )}
          
          {/* Section: Student Details */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">Student Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Student Full Name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={inquiryForm.studentName}
                  onChange={(e) => handleChange("studentName", e.target.value)}
                  placeholder="e.g. Aditya Kulkarni"
                  className={`w-full h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.studentName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={inquiryForm.dateOfBirth}
                  onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                  className={`w-full h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.dateOfBirth ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Class Applied
                </label>
                <Select value={inquiryForm.classAppliedId} onValueChange={(val) => handleChange("classAppliedId", val)}>
                  <SelectTrigger fullWidth className={`h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.classAppliedId ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Gender
                </label>
                <Select value={inquiryForm.gender} onValueChange={(val) => handleChange("gender", val)}>
                  <SelectTrigger fullWidth className={`h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.gender ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}>
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section: Parent Details */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">Parent Details</h3>
            
            <div>
              <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Parent / Guardian Name
              </label>
              <input
                type="text"
                required
                value={inquiryForm.parentName}
                onChange={(e) => handleChange("parentName", e.target.value)}
                className={`w-full h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.parentName ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={inquiryForm.parentPhone}
                  onChange={(e) => handleChange("parentPhone", e.target.value)}
                  className={`w-full h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.parentPhone ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inquiryForm.parentEmail}
                  onChange={(e) => handleChange("parentEmail", e.target.value)}
                  className={`w-full h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.parentEmail ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}
                />
              </div>
            </div>
          </div>

          {/* Section: Additional Details */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">Additional Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  Inquiry Source
                </label>
                <Select value={inquiryForm.source} onValueChange={(val) => handleChange("source", val)}>
                  <SelectTrigger fullWidth className={`h-10 px-3 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all ${errors.source ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}>
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
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                Notes
              </label>
              <textarea
                rows={3}
                value={inquiryForm.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border bg-slate-50/50 dark:bg-zinc-950 text-[13px] text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-1 focus:bg-white transition-all resize-none ${errors.notes ? "border-red-500 focus:border-red-500 focus:ring-red-500" : "border-slate-200 dark:border-zinc-800 focus:border-slate-900 focus:ring-slate-900"}`}
              />
            </div>
          </div>

          {/* Express Admit Section */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Express Enrollment</h3>
                <p className="text-[13px] text-slate-400 mt-1">Bypass admission stages and admit immediately.</p>
              </div>
              <button
                type="button"
                onClick={() => setExpressAdmit(!expressAdmit)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ${expressAdmit ? "bg-white" : "bg-slate-700"}`}
              >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-slate-900 shadow-sm transition-all duration-300 ${expressAdmit ? "translate-x-6" : "translate-x-1 bg-slate-300"}`} />
              </button>
            </div>

            {expressAdmit && (
              <div className="pt-4 border-t border-slate-700/50 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Section *</label>
                    {sectionsLoading ? (
                      <div className="text-[12px] text-slate-400 py-2">Loading...</div>
                    ) : sections.length === 0 ? (
                      <div className="text-[12px] text-amber-400 py-2">Select class first</div>
                    ) : (
                      <Select value={expressForm.sectionId} onValueChange={(val) => handleExpressFieldChange("sectionId", val)}>
                        <SelectTrigger fullWidth className="h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-[13px] shadow-sm text-white">
                          <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 text-white border-slate-700">
                          {sections.map(s => <SelectItem key={s.id} value={s.id} className="hover:bg-slate-700">{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Roll Number</label>
                    <input type="text" value={expressForm.rollNo} onChange={e => handleExpressFieldChange("rollNo", e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-[13px] shadow-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Discount %</label>
                    <input type="number" min="0" max="100" value={expressForm.discountAmount || ""} onChange={e => handleExpressFieldChange("discountAmount", Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-[13px] shadow-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Amount Paid (₹)</label>
                    <BaseCurrencyInput value={expressForm.amountPaid || ""} onChange={e => handleExpressFieldChange("amountPaid", Number(e.target.value))} className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-[13px] shadow-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Payment Mode</label>
                    <Select value={expressForm.paymentMethod} onValueChange={(val) => handleExpressFieldChange("paymentMethod", val)}>
                      <SelectTrigger fullWidth className="h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-[13px] shadow-sm text-white">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 text-white border-slate-700">
                        <SelectItem value="CASH" className="hover:bg-slate-700">Cash</SelectItem>
                        <SelectItem value="ONLINE" className="hover:bg-slate-700">Online Portal</SelectItem>
                        <SelectItem value="UPI" className="hover:bg-slate-700">UPI</SelectItem>
                        <SelectItem value="BANK_TRANSFER" className="hover:bg-slate-700">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-slate-300 mb-1.5">Transaction ID</label>
                    <input type="text" value={expressForm.transactionId} onChange={e => handleExpressFieldChange("transactionId", e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-[13px] shadow-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="h-8"></div> {/* Bottom Padding */}
        </form>
      </div>

      <DiscardConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
      />
    </div>
  );
}
