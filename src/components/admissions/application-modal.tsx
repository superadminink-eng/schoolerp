import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { z } from "zod";
import { 
  candidateInfoSchema, 
  parentInfoSchema, 
  addressInfoSchema,
  createApplicationSchema
} from "@/lib/validations/admission";

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
  onSubmit: (e: React.FormEvent) => Promise<any> | void;
  loading: boolean;
}

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function FormField({ label, error, required, className, ...props }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${error ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          required={required}
          className={`w-full h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
            error 
              ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
              : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
          } ${className}`}
          {...props}
        />
        {props.value && !error && (
           <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
             <Icon name="check_circle" size={18} />
           </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      )}
    </div>
  );
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

function FormTextarea({ label, error, required, className, ...props }: FormTextareaProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${error ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <textarea
          required={required}
          className={`w-full px-5 py-4 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 resize-none min-h-[100px] ${
            error 
              ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950" 
              : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
          } ${className}`}
          {...props}
        />
        {props.value && !error && (
           <div className="absolute right-4 top-4 text-emerald-500">
             <Icon name="check_circle" size={18} />
           </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      )}
    </div>
  );
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
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [highestStep, setHighestStep] = useState<0 | 1 | 2>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const initialFormRef = useRef(appForm);

  useEffect(() => {
    if (open) {
      initialFormRef.current = { ...appForm };
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setErrors({});
      setStep(0);
      setHighestStep(0);
    }
  }, [open]);

  const isFormDirty = () => {
    return JSON.stringify(appForm) !== JSON.stringify(initialFormRef.current);
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
    setAppForm({
      inquiryId: "",
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "MALE",
      bloodGroup: "",
      address: "",
      pincode: "",
      emergencyContact: "",
      fatherName: "",
      fatherPhone: "",
      fatherEmail: "",
      fatherOccupation: "",
      motherName: "",
      motherPhone: "",
      motherEmail: "",
      motherOccupation: "",
      classId: "",
    });
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setAppForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: string) => {
    // We create a partial schema check for the blurred field using the full merged schema
    const schemaShape = (createApplicationSchema as any).shape;
    if (schemaShape && schemaShape[field]) {
      const fieldSchema = schemaShape[field];
      const result = fieldSchema.safeParse(appForm[field as keyof typeof appForm]);
      if (!result.success) {
        setErrors(prev => ({ ...prev, [field]: result.error.errors[0].message }));
      } else {
        setErrors(prev => {
          const copy = { ...prev };
          delete copy[field];
          return copy;
        });
      }
    }
  };

  const validateStep = (currentStepIndex: number): boolean => {
    let schemaToValidate;
    if (currentStepIndex === 0) schemaToValidate = candidateInfoSchema;
    else if (currentStepIndex === 1) schemaToValidate = parentInfoSchema;
    else if (currentStepIndex === 2) schemaToValidate = addressInfoSchema;
    else return true;

    // We must pass branchId and academicYearId as they are in candidateInfoSchema
    // For this modal, we assume they might not be fully present in appForm if not selected, 
    // but the backend requires them. Let's provide dummy values for UI validation if they are missing
    // since the modal doesn't capture branchId/academicYearId directly (they are injected later or implicitly).
    const dataToValidate = {
      ...appForm,
      branchId: appForm.inquiryId ? "dummy-branch" : "dummy-branch", // Bypass branch validation on UI since it's injected
      academicYearId: "dummy-year",
    };

    const result = schemaToValidate.safeParse(dataToValidate);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] !== "branchId" && err.path[0] !== "academicYearId") {
           newErrors[err.path[0] as string] = err.message;
        }
      });
      // Merge with existing errors
      setErrors((prev) => ({ ...prev, ...newErrors }));
      
      // If there are actual UI errors, fail validation
      if (Object.keys(newErrors).length > 0) return false;
    }
    
    // Clear errors for the current step fields
    setErrors(prev => {
       const copy = { ...prev };
       const keys = Object.keys((schemaToValidate as any).shape);
       keys.forEach(k => {
         if (copy[k] && !result.success) {
           // handled above
         } else {
           delete copy[k];
         }
       });
       return copy;
    });

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      const nextStep = (step + 1) as 0 | 1 | 2;
      setStep(nextStep);
      if (nextStep > highestStep) {
        setHighestStep(nextStep);
      }
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((step - 1) as 0 | 1 | 2);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // If Enter is pressed, prevent default submission unless on the final step
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      if (step < 2) {
        handleNext();
      } else {
        // Trigger submit
        handleFormSubmit(e as any);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(2)) return;

    setErrors({});
    const result = await onSubmit(e);
    if (result && !result.success && result.error) {
      if (result.error.code === "VALIDATION_ERROR" && result.error.details) {
        const newErrors: Record<string, string> = {};
        let firstErrorTab: 0 | 1 | 2 | null = null;
        result.error.details.forEach((err: any) => {
          newErrors[err.field] = err.message;
          if (firstErrorTab === null) {
            if (["firstName", "lastName", "dateOfBirth", "gender", "bloodGroup", "classId"].includes(err.field)) {
              firstErrorTab = 0;
            } else if (["fatherName", "fatherPhone", "fatherEmail", "fatherOccupation", "motherName", "motherPhone", "motherEmail", "motherOccupation"].includes(err.field)) {
              firstErrorTab = 1;
            } else if (["address", "pincode", "emergencyContact"].includes(err.field)) {
              firstErrorTab = 2;
            }
          }
        });
        setErrors(newErrors);
        if (firstErrorTab !== null) {
          setStep(firstErrorTab);
        }
      } else if (result.error.message) {
        setErrors({ root: result.error.message });
      }
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

            {/* Global Error Banner */}
            {errors.root && (
              <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3 shrink-0">
                <Icon name="error" className="text-error mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-error">Submission Failed</h4>
                  <p className="text-xs font-semibold text-error/80 mt-1">{errors.root}</p>
                </div>
              </div>
            )}

            {/* Modern Stepper UI */}
            <div className="flex items-center gap-4 mb-8 shrink-0">
              {[
                { label: "Student Profile", icon: "person" },
                { label: "Parents Details", icon: "group" },
                { label: "Contact & Address", icon: "home" }
              ].map((s, i) => {
                const isActive = step === i;
                const isCompleted = i < highestStep;
                const isLocked = i > highestStep;

                return (
                  <div key={i} className="flex items-center flex-1 last:flex-none">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setStep(i as 0|1|2)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
                        isActive 
                          ? "bg-primary/10 ring-1 ring-primary/30" 
                          : isCompleted
                            ? "hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                            : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shrink-0 ${
                        isActive 
                          ? "bg-primary text-white shadow-md"
                          : isCompleted
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-400"
                      }`}>
                        {isCompleted ? <Icon name="check" size={16} /> : i + 1}
                      </div>
                      <div className="flex-col items-start hidden sm:flex">
                        <span className={`text-xs font-bold whitespace-nowrap ${isActive ? "text-primary dark:text-sky-400" : isCompleted ? "text-slate-700 dark:text-zinc-300" : "text-slate-400"}`}>
                          {s.label}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Step {i + 1}
                        </span>
                      </div>
                    </button>
                    {i < 2 && (
                      <div className={`flex-1 h-px mx-2 sm:mx-4 ${isCompleted ? "bg-emerald-500/50" : "bg-slate-200 dark:bg-zinc-800"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scrollable Fields area */}
            <form onSubmit={handleFormSubmit} onKeyDown={handleKeyDown} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-7 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {/* STEP 1: CANDIDATE INFO */}
                {step === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <FormField
                      label="First Name"
                      required
                      value={appForm.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      onBlur={() => handleBlur("firstName")}
                      placeholder="e.g. Rohan"
                      error={errors.firstName}
                    />
                    <FormField
                      label="Last Name"
                      required
                      value={appForm.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      onBlur={() => handleBlur("lastName")}
                      placeholder="e.g. Deshmukh"
                      error={errors.lastName}
                    />
                    <FormField
                      type="date"
                      label="Date of Birth"
                      required
                      value={appForm.dateOfBirth}
                      onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                      onBlur={() => handleBlur("dateOfBirth")}
                      error={errors.dateOfBirth}
                    />
                    <div className="flex flex-col gap-2 w-full">
                      <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.gender ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <Select 
                        value={appForm.gender} 
                        onValueChange={(val) => {
                          handleChange("gender", val);
                          // Select triggers immediately, so we can validate it immediately
                          setTimeout(() => handleBlur("gender"), 0);
                        }}
                      >
                        <SelectTrigger
                          fullWidth
                          className={`h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
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
                    <div className="flex flex-col gap-2 w-full">
                      <label className={`block text-[10.5px] font-extrabold uppercase tracking-wider px-1 select-none ${errors.classId ? "text-error" : "text-slate-400 dark:text-zinc-500"}`}>
                        Target Class <span className="text-red-500">*</span>
                      </label>
                      <Select 
                        value={appForm.classId} 
                        onValueChange={(val) => {
                          handleChange("classId", val);
                          setTimeout(() => handleBlur("classId"), 0);
                        }}
                      >
                        <SelectTrigger
                          fullWidth
                          className={`h-[52px] px-5 rounded-2xl border bg-slate-50/30 dark:bg-zinc-950/20 text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-4 transition-all duration-300 ${
                            errors.classId
                              ? "border-error focus:ring-error/20 focus:border-error focus:bg-white dark:focus:bg-zinc-950"
                              : "border-slate-200 dark:border-zinc-800 focus:ring-primary/8 focus:border-primary focus:bg-white dark:focus:bg-zinc-950"
                          }`}
                        >
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
                      {errors.classId && (
                        <p className="text-[11px] text-error font-semibold px-1 mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">error</span>
                          {errors.classId}
                        </p>
                      )}
                    </div>
                    <FormField
                      label="Blood Group (Optional)"
                      value={appForm.bloodGroup}
                      onChange={(e) => handleChange("bloodGroup", e.target.value)}
                      onBlur={() => handleBlur("bloodGroup")}
                      placeholder="e.g. O+, A+"
                      error={errors.bloodGroup}
                    />
                  </div>
                )}

                {/* STEP 2: PARENTS INFO */}
                {step === 1 && (
                  <div className="space-y-7 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Father Details */}
                    <div className="p-6 md:p-8 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-6 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
                      <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-3 border-slate-100 dark:border-zinc-800">
                        <Icon name="person" size={14} className="text-primary" />
                        Father / Guardian Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <FormField
                          label="Father's Full Name"
                          value={appForm.fatherName}
                          onChange={(e) => handleChange("fatherName", e.target.value)}
                          onBlur={() => handleBlur("fatherName")}
                          placeholder="e.g. Anand Deshmukh"
                          error={errors.fatherName}
                        />
                        <FormField
                          label="Father's Phone Number"
                          value={appForm.fatherPhone}
                          onChange={(e) => handleChange("fatherPhone", e.target.value)}
                          onBlur={() => handleBlur("fatherPhone")}
                          placeholder="10-digit number"
                          error={errors.fatherPhone}
                        />
                        <FormField
                          type="email"
                          label="Father's Email Address"
                          value={appForm.fatherEmail}
                          onChange={(e) => handleChange("fatherEmail", e.target.value)}
                          onBlur={() => handleBlur("fatherEmail")}
                          placeholder="e.g. father@example.com"
                          error={errors.fatherEmail}
                        />
                        <FormField
                          label="Father's Occupation"
                          value={appForm.fatherOccupation}
                          onChange={(e) => handleChange("fatherOccupation", e.target.value)}
                          onBlur={() => handleBlur("fatherOccupation")}
                          placeholder="e.g. Business, Doctor"
                          error={errors.fatherOccupation}
                        />
                      </div>
                    </div>

                    {/* Mother Details */}
                    <div className="p-6 md:p-8 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-6 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
                      <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-3 border-slate-100 dark:border-zinc-800">
                        <Icon name="person" size={14} className="text-pink-500" />
                        Mother Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <FormField
                          label="Mother's Full Name"
                          value={appForm.motherName}
                          onChange={(e) => handleChange("motherName", e.target.value)}
                          onBlur={() => handleBlur("motherName")}
                          placeholder="e.g. Sunita Deshmukh"
                          error={errors.motherName}
                        />
                        <FormField
                          label="Mother's Phone Number"
                          value={appForm.motherPhone}
                          onChange={(e) => handleChange("motherPhone", e.target.value)}
                          onBlur={() => handleBlur("motherPhone")}
                          placeholder="10-digit number"
                          error={errors.motherPhone}
                        />
                        <FormField
                          type="email"
                          label="Mother's Email Address"
                          value={appForm.motherEmail}
                          onChange={(e) => handleChange("motherEmail", e.target.value)}
                          onBlur={() => handleBlur("motherEmail")}
                          placeholder="e.g. mother@example.com"
                          error={errors.motherEmail}
                        />
                        <FormField
                          label="Mother's Occupation"
                          value={appForm.motherOccupation}
                          onChange={(e) => handleChange("motherOccupation", e.target.value)}
                          onBlur={() => handleBlur("motherOccupation")}
                          placeholder="e.g. Teacher, Housewife"
                          error={errors.motherOccupation}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: CONTACT & ADDRESS */}
                {step === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="md:col-span-2">
                      <FormTextarea
                        label="Current Residential Address"
                        required
                        value={appForm.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        onBlur={() => handleBlur("address")}
                        placeholder="Enter complete residential address details..."
                        error={errors.address}
                      />
                    </div>
                    <FormField
                      label="Area Pincode"
                      required
                      value={appForm.pincode}
                      onChange={(e) => handleChange("pincode", e.target.value)}
                      onBlur={() => handleBlur("pincode")}
                      placeholder="6-digit PIN"
                      error={errors.pincode}
                    />
                    <FormField
                      label="Emergency Contact Number"
                      required
                      value={appForm.emergencyContact}
                      onChange={(e) => handleChange("emergencyContact", e.target.value)}
                      onBlur={() => handleBlur("emergencyContact")}
                      placeholder="Alternative guardian number"
                      error={errors.emergencyContact}
                    />
                  </div>
                )}
              </div>

              {/* Form Actions Footer */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-zinc-800 shrink-0">
                <div>
                  <Button
                    type="button"
                    variant="outlined"
                    className="rounded-2xl h-12 px-6 font-bold text-sm"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="flex gap-4">
                  {step > 0 && (
                    <Button
                      type="button"
                      variant="outlined"
                      icon="arrow_back"
                      onClick={handleBack}
                      className="rounded-2xl h-12 px-6 font-bold text-sm border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    >
                      Back
                    </Button>
                  )}
                  
                  {step < 2 ? (
                    <Button
                      type="button"
                      variant="filled"
                      icon="arrow_forward"
                      iconPosition="trailing"
                      onClick={handleNext}
                      className="bg-primary text-white hover:bg-primary/95 rounded-2xl h-12 px-8 font-bold text-sm shadow-lg shadow-primary/20"
                    >
                      Next Step
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="filled"
                      icon="check"
                      loading={loading}
                      className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl h-12 px-8 font-bold text-sm shadow-lg shadow-emerald-500/20"
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
      <DiscardConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={handleConfirmDiscard}
      />
    </>
  );
}
