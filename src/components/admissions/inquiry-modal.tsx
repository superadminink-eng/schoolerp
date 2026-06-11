"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";

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
  onSubmit: (e: React.FormEvent) => void;
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
  const [expressAdmit, setExpressAdmit] = useState(false);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [expressForm, setExpressForm] = useState({
    sectionId: "",
    rollNo: "",
    discountPercent: 0,
    amountPaid: 0,
    paymentMethod: "CASH",
    transactionId: "",
    bypassAgeLimit: false,
  });
  const [expressAdmitting, setExpressAdmitting] = useState(false);

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

  const handleChange = (field: string, value: string) => {
    setInquiryForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleExpressFieldChange = (field: string, value: any) => {
    setExpressForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expressAdmit) {
      onSubmit(e);
      return;
    }

    if (!expressForm.sectionId) {
      snackbar.show("Please select a section for direct intake.", "error");
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

      const res = await fetch("/api/v1/admissions/inquiries/express-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        snackbar.show("Inquiry logged and student admitted successfully!", "success");
        if (onSuccess) onSuccess();
      } else {
        snackbar.show(data.error?.message || "Failed to direct admit student.", "error");
      }
    } catch (err) {
      console.error(err);
      snackbar.show("Network error during direct admission.", "error");
    } finally {
      setExpressAdmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start mb-6">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              New Counselor Inquiry
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
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

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Student Name */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Student Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inquiryForm.studentName}
                onChange={(e) => handleChange("studentName", e.target.value)}
                placeholder="e.g. Aditya Kulkarni"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Class Applied */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Class Applied <span className="text-red-500">*</span>
              </label>
              <Select
                value={inquiryForm.classAppliedId}
                onValueChange={(val) => handleChange("classAppliedId", val)}
              >
                <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={inquiryForm.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Gender <span className="text-red-500">*</span>
              </label>
              <Select
                value={inquiryForm.gender}
                onValueChange={(val) => handleChange("gender", val)}
              >
                <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Parent Name */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Parent / Guardian Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inquiryForm.parentName}
                onChange={(e) => handleChange("parentName", e.target.value)}
                placeholder="e.g. Sanjay Kulkarni"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Parent Phone */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Parent Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inquiryForm.parentPhone}
                onChange={(e) => handleChange("parentPhone", e.target.value)}
                placeholder="10-digit number"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Parent Email */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Parent Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={inquiryForm.parentEmail}
                onChange={(e) => handleChange("parentEmail", e.target.value)}
                placeholder="e.g. parent@example.com"
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
              />
            </div>

            {/* Source */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                Inquiry Source <span className="text-red-500">*</span>
              </label>
              <Select
                value={inquiryForm.source}
                onValueChange={(val) => handleChange("source", val)}
              >
                <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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

          {/* Notes */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
              Intake Conversation Notes
            </label>
            <textarea
              rows={3}
              value={inquiryForm.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Log key student details, bus facility requirements, previous syllabus constraints, etc."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300 resize-none"
            />
          </div>

          {/* Direct Admit Toggle Switch */}
          <div className="p-4 rounded-2xl border border-teal-100 dark:border-teal-950/40 bg-teal-50/10 dark:bg-teal-950/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-teal-600 select-none">person_add</span>
              <div>
                <p className="text-xs font-extrabold text-slate-800 dark:text-zinc-100">
                  Convert to Active Student Immediately (Direct Enrollment)
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
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
            <div className="p-4 rounded-2xl border border-teal-100/50 bg-teal-50/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400 border-b pb-2 border-slate-100 dark:border-zinc-800">
                Direct Onboarding Parameters
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Section */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Assign Section *
                  </label>
                  {sectionsLoading ? (
                    <div className="text-xs text-slate-400 animate-pulse">Loading sections...</div>
                  ) : sections.length === 0 ? (
                    <div className="text-xs text-amber-600 font-semibold">No sections found. Please select class applied first.</div>
                  ) : (
                    <Select
                      value={expressForm.sectionId}
                      onValueChange={(val) => handleExpressFieldChange("sectionId", val)}
                    >
                      <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Roll Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={expressForm.rollNo}
                    onChange={(e) => handleExpressFieldChange("rollNo", e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>

                {/* Discount % */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Discount Percent (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={expressForm.discountPercent || ""}
                    onChange={(e) => handleExpressFieldChange("discountPercent", Number(e.target.value))}
                    placeholder="e.g. 15%"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>

                {/* Amount Paid */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Amount Paid Upfront (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={expressForm.amountPaid || ""}
                    onChange={(e) => handleExpressFieldChange("amountPaid", Number(e.target.value))}
                    placeholder="e.g. 5000"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>

                {/* Payment Method */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Payment Mode
                  </label>
                  <Select
                    value={expressForm.paymentMethod}
                    onValueChange={(val) => handleExpressFieldChange("paymentMethod", val)}
                  >
                    <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Transaction ID / Reference
                  </label>
                  <input
                    type="text"
                    value={expressForm.transactionId}
                    onChange={(e) => handleExpressFieldChange("transactionId", e.target.value)}
                    placeholder="e.g. TXN987654"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
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

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <DialogClose asChild>
              <Button variant="outlined" className="rounded-xl h-11 px-5">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="filled"
              icon={expressAdmit ? "verified" : "save"}
              loading={expressAdmit ? expressAdmitting : loading}
              className={`rounded-xl h-11 px-5 text-white ${
                expressAdmit
                  ? "bg-teal-700 hover:bg-teal-800"
                  : "bg-primary hover:bg-primary/95"
              }`}
            >
              {expressAdmit ? "Save & Enroll Student" : "Log Inquiry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
