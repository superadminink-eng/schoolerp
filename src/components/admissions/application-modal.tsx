import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { createApplicationSchema } from "@/lib/validations/admission";

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const initialFormRef = useRef(appForm);

  useEffect(() => {
    if (open) {
      initialFormRef.current = { ...appForm };
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setErrors({});
      setShowAdvanced(false);
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

  const validateForm = (): boolean => {
    const dataToValidate = {
      ...appForm,
      branchId: appForm.inquiryId ? "dummy-branch" : "dummy-branch",
      academicYearId: "dummy-year",
    };

    const result = createApplicationSchema.safeParse(dataToValidate);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] !== "branchId" && err.path[0] !== "academicYearId") {
           newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors((prev) => ({ ...prev, ...newErrors }));
      
      // If there are errors in advanced fields, make sure to expand the section
      const advancedFields = ["bloodGroup", "address", "pincode", "emergencyContact", "fatherOccupation", "motherOccupation", "motherName", "motherPhone", "motherEmail"];
      const hasAdvancedErrors = Object.keys(newErrors).some(field => advancedFields.includes(field));
      if (hasAdvancedErrors && !showAdvanced) {
        setShowAdvanced(true);
      }

      if (Object.keys(newErrors).length > 0) return false;
    }
    
    return true;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setErrors({});
    const result = await onSubmit(e);
    if (result && !result.success && result.error) {
      if (result.error.code === "VALIDATION_ERROR" && result.error.details) {
        const newErrors: Record<string, string> = {};
        result.error.details.forEach((err: any) => {
          newErrors[err.field] = err.message;
        });
        setErrors(newErrors);

        // Auto-expand advanced if there's an error inside it
        const advancedFields = ["bloodGroup", "address", "pincode", "emergencyContact", "fatherOccupation", "motherOccupation", "motherName", "motherPhone", "motherEmail"];
        const hasAdvancedErrors = Object.keys(newErrors).some(field => advancedFields.includes(field));
        if (hasAdvancedErrors && !showAdvanced) {
          setShowAdvanced(true);
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
                    ? "Review and complete candidate details."
                    : "Submit a new student application."}
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

            {/* Scrollable Fields area */}
            <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto pr-1 space-y-8 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                {/* PRIMARY DETAILS */}
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
                </div>

                {/* ADVANCED DETAILS TOGGLE */}
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary transition-colors"
                  >
                    <div className={`p-1 rounded-full bg-slate-100 dark:bg-zinc-800 transition-transform duration-300 ${showAdvanced ? "rotate-180" : ""}`}>
                      <Icon name="expand_more" size={16} />
                    </div>
                    Advanced Details (Optional)
                  </button>
                </div>

                {/* ADVANCED DETAILS SECTION */}
                {showAdvanced && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-8">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <FormField
                        label="Blood Group"
                        value={appForm.bloodGroup}
                        onChange={(e) => handleChange("bloodGroup", e.target.value)}
                        onBlur={() => handleBlur("bloodGroup")}
                        placeholder="e.g. O+, A+"
                        error={errors.bloodGroup}
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

                    <div className="p-6 md:p-8 rounded-[1.5rem] border border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/10 space-y-6">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 border-b pb-3 border-slate-100 dark:border-zinc-800">
                        <Icon name="person" size={14} className="text-pink-500" />
                        Mother Details (Optional)
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="md:col-span-2">
                        <FormTextarea
                          label="Current Residential Address"
                          value={appForm.address}
                          onChange={(e) => handleChange("address", e.target.value)}
                          onBlur={() => handleBlur("address")}
                          placeholder="Enter complete residential address details..."
                          error={errors.address}
                        />
                      </div>
                      <FormField
                        label="Area Pincode"
                        value={appForm.pincode}
                        onChange={(e) => handleChange("pincode", e.target.value)}
                        onBlur={() => handleBlur("pincode")}
                        placeholder="6-digit PIN"
                        error={errors.pincode}
                      />
                      <FormField
                        label="Emergency Contact Number"
                        value={appForm.emergencyContact}
                        onChange={(e) => handleChange("emergencyContact", e.target.value)}
                        onBlur={() => handleBlur("emergencyContact")}
                        placeholder="Alternative guardian number"
                        error={errors.emergencyContact}
                      />
                    </div>
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
                  <Button
                    type="submit"
                    variant="filled"
                    icon="check"
                    loading={loading}
                    className="bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl h-12 px-8 font-bold text-sm shadow-lg shadow-emerald-500/20"
                  >
                    Submit Application
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
