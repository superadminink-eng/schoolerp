"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Icon } from "@/components/ui/icon";
import { Divider } from "@/components/ui/divider";

export interface FeeInfo {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  applicability: string;
}

export interface CustomInstallment {
  name: string;
  dueDate: string;
  amount: number;
  status?: string;
  paidAmount?: number;
}

interface FeeConfigurationProps {
  fees: FeeInfo[];
  discountPercent: string;
  discountAmount: string;
  amountPaid: string;
  optionalFeeIds: string[];
  customInstallments: CustomInstallment[];
  onUpdate: (field: string, value: any) => void;
}

export function FeeConfiguration({
  fees,
  discountPercent,
  discountAmount,
  amountPaid,
  optionalFeeIds,
  customInstallments,
  onUpdate,
}: FeeConfigurationProps) {
  const [magicGridEnabled, setMagicGridEnabled] = useState(customInstallments.length > 0);

  // Separate mandatory and optional fees
  const mandatoryFees = fees.filter(f => f.applicability === "MANDATORY");
  const optionalFees = fees.filter(f => f.applicability === "OPTIONAL");

  // Calculate annual total
  const { mandatoryTotal, optionalTotal, annualTotal } = useMemo(() => {
    let mTotal = 0;
    let oTotal = 0;

    mandatoryFees.forEach(f => {
      switch (f.frequency) {
        case "MONTHLY": mTotal += f.amount * 12; break;
        case "QUARTERLY": mTotal += f.amount * 4; break;
        case "SEMI_ANNUAL": mTotal += f.amount * 2; break;
        default: mTotal += f.amount;
      }
    });

    optionalFees.filter(f => optionalFeeIds.includes(f.id)).forEach(f => {
      switch (f.frequency) {
        case "MONTHLY": oTotal += f.amount * 12; break;
        case "QUARTERLY": oTotal += f.amount * 4; break;
        case "SEMI_ANNUAL": oTotal += f.amount * 2; break;
        default: oTotal += f.amount;
      }
    });

    return { mandatoryTotal: mTotal, optionalTotal: oTotal, annualTotal: mTotal + oTotal };
  }, [mandatoryFees, optionalFees, optionalFeeIds]);

  // Calculate discounts
  const dPct = parseFloat(discountPercent) || 0;
  const dAmt = parseFloat(discountAmount) || 0;
  // Discount is ONLY applied to Mandatory fees to prevent discount leakage
  const totalDiscount = dAmt + (mandatoryTotal * dPct / 100);
  const discountedTotal = Math.max(0, annualTotal - totalDiscount);

  // Calculate Paid amounts
  const lockedInstallments = customInstallments.filter(i => i.status === "PAID" || i.status === "PARTIAL");
  const lockedSum = lockedInstallments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const remainingBalanceToBill = Math.max(0, discountedTotal - lockedSum);

  // Magic Grid handlers
  const handleAddInstallment = () => {
    const newInst: CustomInstallment = {
      name: `Installment ${customInstallments.length + 1}`,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().slice(0, 10),
      amount: 0,
      status: "PENDING",
      paidAmount: 0,
    };
    onUpdate("customInstallments", [...customInstallments, newInst]);
  };

  const handleRemoveInstallment = (index: number) => {
    const newInsts = [...customInstallments];
    newInsts.splice(index, 1);
    onUpdate("customInstallments", newInsts);
  };

  const handleUpdateInstallment = (index: number, field: keyof CustomInstallment, value: any) => {
    const newInsts = [...customInstallments];
    newInsts[index] = { ...newInsts[index], [field]: value };
    onUpdate("customInstallments", newInsts);
  };

  const handleDistributeEvenly = useCallback(() => {
    const pendingIndices = customInstallments
      .map((inst, idx) => inst.status === "PAID" || inst.status === "PARTIAL" ? -1 : idx)
      .filter(idx => idx !== -1);
      
    if (pendingIndices.length === 0) return;
    
    const count = pendingIndices.length;
    const baseAmount = Math.floor(remainingBalanceToBill / count);
    const remainder = remainingBalanceToBill - (baseAmount * count);
    
    const newInsts = [...customInstallments];
    pendingIndices.forEach((idx, i) => {
      newInsts[idx] = {
        ...newInsts[idx],
        amount: i === count - 1 ? baseAmount + remainder : baseAmount
      };
    });
    
    onUpdate("customInstallments", newInsts);
  }, [customInstallments, remainingBalanceToBill, onUpdate]);

  const toggleOptionalFee = (id: string) => {
    if (optionalFeeIds.includes(id)) {
      onUpdate("optionalFeeIds", optionalFeeIds.filter(fid => fid !== id));
    } else {
      onUpdate("optionalFeeIds", [...optionalFeeIds, id]);
    }
  };

  const currentGridSum = customInstallments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const isSumMismatch = magicGridEnabled && Math.abs(currentGridSum - discountedTotal) > 0.01;

  // Auto-distribute when discountedTotal changes or if there is a mismatch on load
  // This drastically improves UX by removing immediate red errors and keeping things synced
  const prevDiscountedTotalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!magicGridEnabled) return;
    
    // If it's the first mount, only auto-distribute if there's a mismatch (fixes legacy data)
    if (prevDiscountedTotalRef.current === null) {
      prevDiscountedTotalRef.current = discountedTotal;
      if (Math.abs(currentGridSum - discountedTotal) > 0.01) {
         handleDistributeEvenly();
      }
      return;
    }

    // If the total changed due to checking/unchecking optional fees or discount change
    if (prevDiscountedTotalRef.current !== discountedTotal) {
      prevDiscountedTotalRef.current = discountedTotal;
      handleDistributeEvenly();
    }
  }, [discountedTotal, magicGridEnabled, currentGridSum, handleDistributeEvenly]);

  return (
    <div className="space-y-6">
      {/* 1. Mandatory Fees */}
      <div className="rounded-lg border border-outline-variant p-4 space-y-2 bg-surface-container-lowest">
        <p className="text-label-lg font-bold text-on-surface">Mandatory Fee Structure</p>
        {mandatoryFees.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">No mandatory fees found.</p>
        ) : (
          mandatoryFees.map((fee, i) => (
            <div key={fee.id} className="flex items-center justify-between text-body-sm text-on-surface-variant py-1">
              <span>{fee.name}</span>
              <span>₹{fee.amount.toLocaleString("en-IN")} / {fee.frequency.replace(/_/g, " ").toLowerCase()}</span>
            </div>
          ))
        )}
      </div>

      {/* 2. Optional Fees */}
      {optionalFees.length > 0 && (
        <div className="rounded-lg border border-outline-variant p-4 space-y-3">
          <p className="text-label-lg font-bold text-on-surface">Optional Services</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {optionalFees.map((fee) => (
              <label 
                key={fee.id} 
                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  optionalFeeIds.includes(fee.id) ? 'border-primary bg-primary/5' : 'border-outline-variant hover:bg-surface-container'
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={optionalFeeIds.includes(fee.id)} 
                  onChange={() => toggleOptionalFee(fee.id)}
                  className="w-4 h-4 text-primary rounded border-outline"
                />
                <div className="flex-1">
                  <p className="text-label-md font-medium">{fee.name}</p>
                  <p className="text-body-sm text-on-surface-variant">₹{fee.amount.toLocaleString("en-IN")} / {fee.frequency.replace(/_/g, " ").toLowerCase()}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <Divider />
      
      {/* 3. Discount & Total */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
        <div>
          <p className="text-body-sm text-on-surface-variant mb-1">Annual Total (Before Discount)</p>
          <p className="text-title-md font-bold text-on-surface">₹{annualTotal.toLocaleString("en-IN")}</p>
        </div>
        <div className="space-y-3">
          <TextField
            label="Discount %"
            type="number"
            value={discountPercent}
            onChange={(e) => onUpdate("discountPercent", e.target.value)}
            fullWidth
          />
          <CurrencyInput
            label="Flat Discount (₹)"
            value={discountAmount}
            onChange={(val) => onUpdate("discountAmount", val)}
            fullWidth
          />
        </div>
        <div className="bg-primary-container text-on-primary-container p-4 rounded-xl">
          <p className="text-label-md opacity-80 mb-1">Final Payable Total</p>
          <p className="text-headline-sm font-black">₹{discountedTotal.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <Divider />

      {/* 4. Magic Grid (Custom Installments) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-label-lg font-bold text-on-surface">Upfront Billing Schedule (Magic Grid)</p>
            <p className="text-body-sm text-on-surface-variant mt-1 max-w-2xl">
              By default, the entire fee is billed immediately with a 30-day due date. Enable the Magic Grid to split this bill into custom upfront invoices (installments).
            </p>
          </div>
          <Button 
            type="button"
            variant={magicGridEnabled ? "filled" : "outlined"} 
            onClick={() => {
              const newState = !magicGridEnabled;
              setMagicGridEnabled(newState);
              if (!newState) {
                onUpdate("customInstallments", []);
              } else if (customInstallments.length === 0) {
                // Initialize with 1 installment
                onUpdate("customInstallments", [{
                  name: "Installment 1",
                  dueDate: new Date().toISOString().slice(0, 10),
                  amount: discountedTotal
                }]);
              }
            }}
          >
            {magicGridEnabled ? "Disable Grid" : "Enable Magic Grid"}
          </Button>
        </div>

        {magicGridEnabled && (
          <div className="bg-surface-container p-4 rounded-xl space-y-4 border border-outline-variant">
            <div className="flex items-center justify-between mb-2">
               <Button type="button" variant="text" icon="add" onClick={handleAddInstallment}>
                 Add Installment
               </Button>
               <Button type="button" variant="tonal" icon="balance" onClick={handleDistributeEvenly}>
                 Distribute Evenly
               </Button>
            </div>
            
            <div className="space-y-3">
              {customInstallments.map((inst, idx) => {
                const isPaid = inst.status === "PAID" || inst.status === "PARTIAL";
                return (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-surface p-3 rounded-lg border border-outline-variant">
                  <div className="w-full sm:w-1/3">
                    <TextField
                      label={isPaid ? `Installment Name (${inst.status})` : "Installment Name"}
                      value={inst.name}
                      onChange={(e) => handleUpdateInstallment(idx, "name", e.target.value)}
                      disabled={isPaid}
                      fullWidth
                    />
                  </div>
                  <div className="w-full sm:w-1/4">
                    <TextField
                      label="Due Date"
                      type="date"
                      value={inst.dueDate}
                      onChange={(e) => handleUpdateInstallment(idx, "dueDate", e.target.value)}
                      disabled={isPaid}
                      fullWidth
                    />
                  </div>
                  <div className="w-full sm:w-1/3">
                    <CurrencyInput
                      label="Amount (₹)"
                      value={String(inst.amount)}
                      onChange={(val) => handleUpdateInstallment(idx, "amount", Number(val))}
                      disabled={isPaid}
                      fullWidth
                    />
                  </div>
                  <div className="flex justify-end w-full sm:w-auto mt-2 sm:mt-0">
                    <button 
                      type="button" 
                      onClick={() => !isPaid && handleRemoveInstallment(idx)}
                      disabled={isPaid}
                      className={`p-2 rounded-full transition-colors ${isPaid ? 'text-outline opacity-50 cursor-not-allowed' : 'text-error hover:bg-error/10'}`}
                      title={isPaid ? "Cannot remove paid installment" : "Remove"}
                    >
                      <Icon name="delete" size={20} />
                    </button>
                  </div>
                </div>
              )})}
            </div>

            <div className={`p-3 mt-4 rounded border flex justify-between items-center ${isSumMismatch ? 'bg-error-container text-on-error-container border-error/50' : 'bg-primary-container text-on-primary-container border-primary/20'}`}>
               <span className="font-bold">Grid Sum Validation:</span>
               <div className="text-right">
                 <span className="text-title-md font-bold">₹{currentGridSum.toLocaleString("en-IN")}</span>
                 <span className="mx-2">/</span>
                 <span className="opacity-80">₹{discountedTotal.toLocaleString("en-IN")}</span>
               </div>
            </div>
            {isSumMismatch && (
              <p className="text-sm font-medium text-error mt-1 flex items-center gap-1">
                <Icon name="warning" size={16} /> Sum of installments must exactly match Final Payable Total.
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
