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
      <DialogContent
        overlayClassName="fixed left-0 md:left-20 xl:left-[280px] top-20 right-0 bottom-0 inset-auto bg-transparent backdrop-blur-none"
        className="fixed left-0 md:left-20 xl:left-[280px] top-20 right-0 bottom-0 w-auto h-auto max-w-none max-h-none translate-x-0 translate-y-0 rounded-none bg-white dark:bg-zinc-900 border-0 shadow-none flex flex-col p-6 md:p-10 md:py-12 overflow-hidden"
      >
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full overflow-hidden min-h-0">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 border-b border-slate-100/80 dark:border-zinc-800/80 pb-5 shrink-0 pr-12">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
              {appForm.inquiryId ? "Convert Inquiry to Application" : "New Admission Application"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5">
              {appForm.inquiryId
                ? "Review and complete the pre-filled candidate details to register the application."
                : "Submit a new student registration application directly into the admissions pipeline."}
            </DialogDescription>
          </div>
        </div>

        {/* Wizard Segment Toggles */}
        <div className="flex items-center gap-2.5 p-1.5 bg-slate-50 dark:bg-zinc-950/40 rounded-2xl border border-slate-100 dark:border-zinc-800/60 mb-7 shrink-0">
          <button
            type="button"
            onClick={() => setActiveFormTab("candidate")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-extrabold rounded-xl transition-all duration-200 ${
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
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-extrabold rounded-xl transition-all duration-200 ${
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
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-extrabold rounded-xl transition-all duration-200 ${
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
          <div className="flex-1 overflow-y-auto pr-1 space-y-7 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* TAB 1: CANDIDATE INFO */}
            {activeFormTab === "candidate" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    placeholder="e.g. Rohan"
                    className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    placeholder="e.g. Deshmukh"
                    className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={appForm.dateOfBirth}
                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                    className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <Select value={appForm.gender} onValueChange={(val) => handleChange("gender", val)}>
                    <SelectTrigger fullWidth className="h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
                      <SelectValue placeholder="Select Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Target Class <span className="text-red-500">*</span>
                  </label>
                  <Select value={appForm.classId} onValueChange={(val) => handleChange("classId", val)}>
                    <SelectTrigger fullWidth className="h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300">
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
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Blood Group (Optional)
                  </label>
                  <input
                    type="text"
                    value={appForm.bloodGroup}
                    onChange={(e) => handleChange("bloodGroup", e.target.value)}
                    placeholder="e.g. O+, A+"
                    className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: PARENTS INFO */}
            {activeFormTab === "parents" && (
              <div className="space-y-7">
                {/* Father Details */}
                <div className="p-6 md:p-8 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-6">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <Icon name="person" size={14} className="text-primary" />
                    Father / Guardian Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Father's Full Name
                      </label>
                      <input
                        type="text"
                        value={appForm.fatherName}
                        onChange={(e) => handleChange("fatherName", e.target.value)}
                        placeholder="e.g. Anand Deshmukh"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Father's Phone Number
                      </label>
                      <input
                        type="text"
                        value={appForm.fatherPhone}
                        onChange={(e) => handleChange("fatherPhone", e.target.value)}
                        placeholder="10-digit number"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Father's Email Address
                      </label>
                      <input
                        type="email"
                        value={appForm.fatherEmail}
                        onChange={(e) => handleChange("fatherEmail", e.target.value)}
                        placeholder="e.g. father@example.com"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Father's Occupation
                      </label>
                      <input
                        type="text"
                        value={appForm.fatherOccupation}
                        onChange={(e) => handleChange("fatherOccupation", e.target.value)}
                        placeholder="e.g. Business, Doctor"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Mother Details */}
                <div className="p-6 md:p-8 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-6">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-3 border-slate-100 dark:border-zinc-800">
                    <Icon name="person" size={14} className="text-pink-500" />
                    Mother Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Mother's Full Name
                      </label>
                      <input
                        type="text"
                        value={appForm.motherName}
                        onChange={(e) => handleChange("motherName", e.target.value)}
                        placeholder="e.g. Sunita Deshmukh"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Mother's Phone Number
                      </label>
                      <input
                        type="text"
                        value={appForm.motherPhone}
                        onChange={(e) => handleChange("motherPhone", e.target.value)}
                        placeholder="10-digit number"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Mother's Email Address
                      </label>
                      <input
                        type="email"
                        value={appForm.motherEmail}
                        onChange={(e) => handleChange("motherEmail", e.target.value)}
                        placeholder="e.g. mother@example.com"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                        Mother's Occupation
                      </label>
                      <input
                        type="text"
                        value={appForm.motherOccupation}
                        onChange={(e) => handleChange("motherOccupation", e.target.value)}
                        placeholder="e.g. Teacher, Housewife"
                        className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONTACT & ADDRESS */}
            {activeFormTab === "address" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Current Residential Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={appForm.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Enter complete residential address details..."
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300 resize-none min-h-[100px]"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Area Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.pincode}
                    onChange={(e) => handleChange("pincode", e.target.value)}
                    placeholder="6-digit PIN"
                    className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1 select-none">
                    Emergency Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appForm.emergencyContact}
                    onChange={(e) => handleChange("emergencyContact", e.target.value)}
                    placeholder="Alternative guardian number"
                    className="w-full h-[52px] px-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950 transition-all duration-300"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-zinc-800 shrink-0">
            <div>
              {activeFormTab === "parents" && (
                <Button
                  type="button"
                  variant="outlined"
                  icon="arrow_back"
                  onClick={() => setActiveFormTab("candidate")}
                  className="rounded-2xl h-12 px-6 font-bold text-sm"
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
                  className="rounded-2xl h-12 px-6 font-bold text-sm"
                >
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-4">
              <DialogClose asChild>
                <Button variant="outlined" className="rounded-2xl h-12 px-6 font-bold text-sm">
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
                  className="bg-primary text-white rounded-2xl h-12 px-6 font-bold text-sm"
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
                  className="bg-primary text-white rounded-2xl h-12 px-6 font-bold text-sm"
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
                  className="bg-primary text-white hover:bg-primary/95 rounded-2xl h-12 px-6 font-bold text-sm"
                >
                  Submit Application
                </Button>
              )}
            </div>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
