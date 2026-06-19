"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { AuthErrorAlert } from "./auth-error-alert";
import { cn } from "@/lib/utils";

function ResetPasswordFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Verify action token (oobCode) on mount securely on the server
  useEffect(() => {
    if (!oobCode) {
      setError("Reset token is missing. Please request a new password reset link.");
      setVerifying(false);
      return;
    }

    fetch(`/api/v1/auth/reset-password-verify?oobCode=${oobCode}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Invalid token");
        }
        setEmail(data.data.email);
        setVerifying(false);
      })
      .catch((err) => {
        console.error("Token verification error:", err);
        setError(err.message || "The reset link is invalid or has expired. Please request a new one.");
        setVerifying(false);
      });
  }, [oobCode]);

  // Password criteria verification
  const passwordCriteria = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    symbol: /[^A-Za-z0-9]/.test(newPassword),
  };
  const metCount = Object.values(passwordCriteria).filter(Boolean).length;
  const isPasswordSecure = metCount >= 4;

  let strengthLabel = "Weak";
  let strengthColor = "bg-error text-on-error";
  if (metCount >= 5) {
    strengthLabel = "Very Strong";
    strengthColor = "bg-success text-on-success";
  } else if (metCount >= 4) {
    strengthLabel = "Strong";
    strengthColor = "bg-primary text-on-primary";
  } else if (metCount >= 3) {
    strengthLabel = "Medium";
    strengthColor = "bg-warning text-on-warning";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!oobCode) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isPasswordSecure) {
      setError("Please choose a stronger password.");
      return;
    }

    setLoading(true);
    try {
      // Send oobCode and newPassword to the secure reset password confirm API
      const res = await fetch("/api/v1/auth/reset-password-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to reset password.");
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("ConfirmPasswordReset/Sync error:", err);
      setError(err.message || "Failed to reset password. The reset link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center py-10 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-tight">Verifying secure reset token...</p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center py-8 space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/40 text-primary shadow-inner mb-1">
            <Icon name="check_circle" size={24} className="text-primary animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">Password updated!</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
              Your security credentials have been updated. You can now log in using your new credentials.
            </p>
          </div>
          <div className="pt-2">
            <Button 
              variant="filled" 
              fullWidth 
              onClick={() => router.push("/login")}
              className="h-10 text-xs font-bold uppercase tracking-wider bg-primary text-white rounded-lg transition-transform active:scale-98 shadow-sm cursor-pointer border-none"
            >
              Go to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <AuthErrorAlert message={error} />

          {!email ? (
            <div className="text-center py-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                Unable to verify user account. Please go back to request a new link.
              </p>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={() => router.push("/forgot-password")}
                className="h-10 text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer bg-transparent"
              >
                Request new link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/40 flex items-center gap-2 mb-2 select-none">
                <Icon name="person" size={15} className="text-slate-400" />
                <span className="text-xs text-slate-650 dark:text-slate-455 font-bold">
                  Resetting for <strong className="text-slate-900 dark:text-slate-50 font-extrabold">{email}</strong>
                </span>
              </div>

              <TextField
                label="New Password"
                variant="compact"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leadingIcon="lock"
                trailingIcon={showPassword ? "visibility_off" : "visibility"}
                onTrailingIconClick={() => setShowPassword(!showPassword)}
                required
                fullWidth
                autoComplete="new-password"
              />

              <TextField
                label="Confirm Password"
                variant="compact"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leadingIcon="lock"
                required
                fullWidth
                autoComplete="new-password"
              />

              {/* Password Strength Checklist */}
              {newPassword && (
                <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Password Strength:</span>
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", strengthColor)}>
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-350", 
                        metCount >= 4 ? "bg-primary" : metCount >= 3 ? "bg-warning" : "bg-error"
                      )}
                      style={{ width: `${(metCount / 5) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-[10.5px] font-bold">
                    <div className={cn("flex items-center gap-1", passwordCriteria.length ? "text-primary" : "text-slate-400 dark:text-slate-500")}>
                      <Icon name={passwordCriteria.length ? "check" : "cancel"} size={13} />
                      8+ Characters
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.upper ? "text-primary" : "text-slate-400 dark:text-slate-500")}>
                      <Icon name={passwordCriteria.upper ? "check" : "cancel"} size={13} />
                      Uppercase letter
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.lower ? "text-primary" : "text-slate-400 dark:text-slate-500")}>
                      <Icon name={passwordCriteria.lower ? "check" : "cancel"} size={13} />
                      Lowercase letter
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.number ? "text-primary" : "text-slate-400 dark:text-slate-500")}>
                      <Icon name={passwordCriteria.number ? "check" : "cancel"} size={13} />
                      One number
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.symbol ? "text-primary" : "text-slate-400 dark:text-slate-500")}>
                      <Icon name={passwordCriteria.symbol ? "check" : "cancel"} size={13} />
                      Special character
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="filled"
                fullWidth
                loading={loading}
                disabled={!isPasswordSecure || loading}
                icon="check"
                className="h-10 text-xs font-bold uppercase tracking-wider bg-primary text-white rounded-lg transition-transform active:scale-98 shadow-sm cursor-pointer border-none"
              >
                Reset password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-center mt-6 text-xs text-slate-550 dark:text-slate-400 font-medium">
        <Link href="/login" className="text-primary font-bold hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={
      <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center py-10 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-slate-550 dark:text-slate-400 font-bold tracking-tight">Loading reset interface...</p>
        </CardContent>
      </Card>
    }>
      <ResetPasswordFormContent />
    </Suspense>
  );
}
