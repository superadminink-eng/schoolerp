"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSnackbar } from "@/components/ui/snackbar";
import { BaseCurrencyInput } from "@/components/ui/base-currency-input";

interface FollowUp {
  id: string;
  followUpDate: string;
  conversationNotes: string;
  nextFollowUpDate: string | null;
  statusReached: string;
  counselorId?: string;
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
  loading: boolean;
  onSuccess?: () => void;
}

export default function InquiryWorkspace({
  open,
  onOpenChange,
  selectedInquiry,
  loading,
  onSuccess,
}: InquiryWorkspaceProps) {
  const snackbar = useSnackbar();
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  
  // Express Admit Form State
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

  useEffect(() => {
    if (selectedInquiry?.classApplied?.id) {
      setSectionsLoading(true);
      fetch(`/api/v1/classes/${selectedInquiry.classApplied.id}/sections`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSections(data.data);
            if (data.data.length > 0) {
              setExpressForm((prev) => ({ ...prev, sectionId: data.data[0].id }));
            }
          }
        })
        .catch((err) => console.error("Error loading sections:", err))
        .finally(() => setSectionsLoading(false));
    }
  }, [selectedInquiry]);

  if (!selectedInquiry) return null;

  const handleExpressFieldChange = (field: string, value: any) => {
    setExpressForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpressAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expressForm.sectionId) {
      snackbar.show("Please select a section.", "error");
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
      const res = await fetch(`/api/v1/admissions/inquiries/${selectedInquiry.id}/express-admit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expressForm),
      });
      const data = await res.json();
      if (data.success) {
        snackbar.show("Student enrolled successfully!", "success");
        if (onSuccess) onSuccess();
      } else {
        snackbar.show(data.error?.message || "Failed to admit candidate.", "error");
      }
    } catch (err) {
      console.error(err);
      snackbar.show("Network error during admission.", "error");
    } finally {
      setExpressAdmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/20 flex items-center justify-between shrink-0">
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
            <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-zinc-100 mt-1.5 flex items-center gap-2">
              <Icon name="person_add" size={18} className="text-teal-600" />
              Express Admit Pipeline: {selectedInquiry.studentName}
            </DialogTitle>
          </div>
        </div>

        {/* Split Pane Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel: Profile Details */}
          <div className="w-[35%] overflow-y-auto p-4 bg-slate-50/50 dark:bg-zinc-950/10 border-r border-slate-100 dark:border-zinc-800/80 space-y-6">
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

          {/* Right Panel: Express Admit Form */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {selectedInquiry.status !== "APPLIED" ? (
                  <form onSubmit={handleExpressAdmitSubmit} className="p-4 rounded-2xl border border-teal-100 dark:border-teal-950/40 bg-teal-50/10 dark:bg-teal-950/[0.02] space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b pb-2 border-slate-100 dark:border-zinc-800">
                      <Icon name="verified" size={14} className="text-teal-600" />
                      Direct Intake/Admission (Class: {selectedInquiry.classApplied?.name || "N/A"})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Section Selection */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                          Assign Section *
                        </label>
                        {sectionsLoading ? (
                          <div className="text-xs text-slate-400 animate-pulse">Loading sections...</div>
                        ) : sections.length === 0 ? (
                          <div className="text-xs text-amber-600 font-semibold">No sections found for this class. Create them first.</div>
                        ) : (
                          <Select
                            value={expressForm.sectionId}
                            onValueChange={(val) => handleExpressFieldChange("sectionId", val)}
                          >
                            <SelectTrigger fullWidth className="h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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

                      {/* Roll Number */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                          Roll Number (Optional)
                        </label>
                        <input
                          type="text"
                          value={expressForm.rollNo}
                          onChange={(e) => handleExpressFieldChange("rollNo", e.target.value)}
                          placeholder="e.g. 15"
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                        />
                      </div>

                      {/* Discount Percent */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                          Discount Percent (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={expressForm.discountAmount || ""}
                          onChange={(e) => handleExpressFieldChange("discountAmount", Number(e.target.value))}
                          placeholder="e.g. 10%"
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                        />
                      </div>

                      {/* Amount Paid */}
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                          Amount Paid Upfront (₹)
                        </label>
                        <BaseCurrencyInput
                          value={expressForm.amountPaid || ""}
                          onChange={(e) => handleExpressFieldChange("amountPaid", Number(e.target.value))}
                          placeholder="e.g. 5000"
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
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
                          <SelectTrigger fullWidth className="h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                        />
                      </div>
                    </div>

                    {/* Checkboxes for Age Bypass */}
                    <div className="flex items-center gap-2 pt-1 pl-1">
                      <input
                        type="checkbox"
                        id="bypassAgeLimit"
                        checked={expressForm.bypassAgeLimit}
                        onChange={(e) => handleExpressFieldChange("bypassAgeLimit", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <label htmlFor="bypassAgeLimit" className="text-xs text-slate-500 font-semibold cursor-pointer select-none">
                        Bypass age validation constraint (Under 3 years old)
                      </label>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="submit"
                        variant="filled"
                        icon="verified"
                        loading={expressAdmitting}
                        className="bg-teal-700 text-white hover:bg-teal-800 rounded-xl h-10 px-5 text-xs font-bold"
                      >
                        Enroll Student Now
                      </Button>
                    </div>
                  </form>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-zinc-950/20 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 text-center">
                  <Icon name="check_circle" size={48} className="text-emerald-500 mb-3" />
                  <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Application Submitted</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[250px]">
                    This inquiry has already been converted to a full application. Follow-up is disabled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
