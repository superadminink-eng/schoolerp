"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

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
}

export default function InquiryModal({
  open,
  onOpenChange,
  classes,
  inquiryForm,
  setInquiryForm,
  onSubmit,
  loading,
}: InquiryModalProps) {
  const handleChange = (field: string, value: string) => {
    setInquiryForm((prev: any) => ({ ...prev, [field]: value }));
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
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
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
              icon="save"
              loading={loading}
              className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-5"
            >
              Log Inquiry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
