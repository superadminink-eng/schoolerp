"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface ClassItem {
  id: string;
  name: string;
}

interface ApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassItem[];
  appForm: {
    inquiryId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
    address: string;
    pincode: string;
    emergencyContact: string;
    fatherName: string;
    fatherPhone: string;
    fatherEmail: string;
    fatherOccupation: string;
    motherName: string;
    motherPhone: string;
    motherEmail: string;
    motherOccupation: string;
    classId: string;
  };
  setAppForm: (val: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export default function ApplicationModal({
  open,
  onOpenChange,
  classes,
  appForm,
  setAppForm,
  onSubmit,
  loading,
}: ApplicationModalProps) {
  const [activeFormTab, setActiveFormTab] = useState<"candidate" | "parents" | "address">("candidate");

  const handleChange = (field: string, value: string) => {
    setAppForm((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              {appForm.inquiryId ? "Convert Inquiry to Application" : "New Admission Application"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
              {appForm.inquiryId
                ? "Review and complete the pre-filled candidate details to register the application."
                : "Submit a new student registration application directly into the admissions pipeline."}
            </DialogDescription>
          </div>
        </div>

        {/* Wizard Segment Toggles */}
        <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-zinc-950/40 rounded-2xl border border-slate-100 dark:border-zinc-800/60 mb-5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveFormTab("candidate")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeFormTab === "candidate"
                ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm ring-1 ring-slate-100 dark:ring-zinc-800/40"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon name="person" size={14} />
            Student Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab("parents")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeFormTab === "parents"
                ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm ring-1 ring-slate-100 dark:ring-zinc-800/40"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon name="group" size={14} />
            Parents Details
          </button>
          <button
            type="button"
            onClick={() => setActiveFormTab("address")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
              activeFormTab === "address"
                ? "bg-white dark:bg-zinc-900 text-primary dark:text-sky-400 shadow-sm ring-1 ring-slate-100 dark:ring-zinc-800/40"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon name="home" size={14} />
            Contact & Address
          </button>
        </div>

        {/* Scrollable Fields area */}
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto pr-1 space-y-6 pb-4">
            {/* TAB 1: CANDIDATE INFO */}
            {activeFormTab === "candidate" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    placeholder="e.g. Rohan"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    placeholder="e.g. Deshmukh"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={appForm.dateOfBirth}
                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <Select value={appForm.gender} onValueChange={(val) => handleChange("gender", val)}>
                    <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Target Class <span className="text-red-500">*</span>
                  </label>
                  <Select value={appForm.classId} onValueChange={(val) => handleChange("classId", val)}>
                    <SelectTrigger fullWidth className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                      <SelectValue placeholder="Select Target Class" />
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
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Blood Group (Optional)
                  </label>
                  <input
                    type="text"
                    value={appForm.bloodGroup}
                    onChange={(e) => handleChange("bloodGroup", e.target.value)}
                    placeholder="e.g. O+, A+"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: PARENTS INFO */}
            {activeFormTab === "parents" && (
              <div className="space-y-6">
                {/* Father Details */}
                <div className="p-5 rounded-2xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-2">
                    <Icon name="person" size={14} className="text-primary" />
                    Father / Guardian Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Father's Full Name
                      </label>
                      <input
                        type="text"
                        value={appForm.fatherName}
                        onChange={(e) => handleChange("fatherName", e.target.value)}
                        placeholder="e.g. Anand Deshmukh"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Father's Phone Number
                      </label>
                      <input
                        type="text"
                        value={appForm.fatherPhone}
                        onChange={(e) => handleChange("fatherPhone", e.target.value)}
                        placeholder="10-digit number"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Father's Email Address
                      </label>
                      <input
                        type="email"
                        value={appForm.fatherEmail}
                        onChange={(e) => handleChange("fatherEmail", e.target.value)}
                        placeholder="e.g. father@example.com"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Father's Occupation
                      </label>
                      <input
                        type="text"
                        value={appForm.fatherOccupation}
                        onChange={(e) => handleChange("fatherOccupation", e.target.value)}
                        placeholder="e.g. Business, Doctor"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Mother Details */}
                <div className="p-5 rounded-2xl border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-2">
                    <Icon name="person" size={14} className="text-pink-500" />
                    Mother Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Mother's Full Name
                      </label>
                      <input
                        type="text"
                        value={appForm.motherName}
                        onChange={(e) => handleChange("motherName", e.target.value)}
                        placeholder="e.g. Sunita Deshmukh"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Mother's Phone Number
                      </label>
                      <input
                        type="text"
                        value={appForm.motherPhone}
                        onChange={(e) => handleChange("motherPhone", e.target.value)}
                        placeholder="10-digit number"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Mother's Email Address
                      </label>
                      <input
                        type="email"
                        value={appForm.motherEmail}
                        onChange={(e) => handleChange("motherEmail", e.target.value)}
                        placeholder="e.g. mother@example.com"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                        Mother's Occupation
                      </label>
                      <input
                        type="text"
                        value={appForm.motherOccupation}
                        onChange={(e) => handleChange("motherOccupation", e.target.value)}
                        placeholder="e.g. Teacher, Housewife"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONTACT & ADDRESS */}
            {activeFormTab === "address" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Current Residential Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={appForm.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Enter complete residential address details..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300 resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Area Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.pincode}
                    onChange={(e) => handleChange("pincode", e.target.value)}
                    placeholder="6-digit PIN"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 select-none">
                    Emergency Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.emergencyContact}
                    onChange={(e) => handleChange("emergencyContact", e.target.value)}
                    placeholder="Alternative guardian number"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-zinc-800 shrink-0">
            <div>
              {activeFormTab === "parents" && (
                <Button
                  type="button"
                  variant="outlined"
                  icon="arrow_back"
                  onClick={() => setActiveFormTab("candidate")}
                  className="rounded-xl h-11"
                >
                  Back
                </Button>
              )}
              {activeFormTab === "address" && (
                <Button
                  type="button"
                  variant="outlined"
                  icon="arrow_back"
                  onClick={() => setActiveFormTab("parents")}
                  className="rounded-xl h-11"
                >
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-3">
              <DialogClose asChild>
                <Button variant="outlined" className="rounded-xl h-11 px-5">
                  Cancel
                </Button>
              </DialogClose>
              
              {activeFormTab === "candidate" && (
                <Button
                  type="button"
                  variant="filled"
                  icon="arrow_forward"
                  iconPosition="trailing"
                  onClick={() => setActiveFormTab("parents")}
                  className="bg-primary text-white rounded-xl h-11 px-5"
                >
                  Next: Parents
                </Button>
              )}
              
              {activeFormTab === "parents" && (
                <Button
                  type="button"
                  variant="filled"
                  icon="arrow_forward"
                  iconPosition="trailing"
                  onClick={() => setActiveFormTab("address")}
                  className="bg-primary text-white rounded-xl h-11 px-5"
                >
                  Next: Address
                </Button>
              )}

              {activeFormTab === "address" && (
                <Button
                  type="submit"
                  variant="filled"
                  icon="save"
                  loading={loading}
                  className="bg-primary text-white hover:bg-primary/95 rounded-xl h-11 px-6"
                >
                  Submit Application
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
