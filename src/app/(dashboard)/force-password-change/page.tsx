import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSnackbar } from "@/components/ui/snackbar";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const snackbar = useSnackbar();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    if (!session?.user) {
      setError("Authentication session not found. Please log in again.");
      return;
    }
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
      // Send newPassword to change-password API, which handles Firebase & MySQL update securely
      const res = await fetch("/api/v1/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "Failed to update credentials.");
      }

      snackbar.show("Password updated successfully!", "success");

      // 3. Update local NextAuth session state with new tokenVersion to avoid immediate logout
      await update({
        forcePasswordChange: false,
        tokenVersion: data.data.tokenVersion,
      });

      // 4. Redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error("Force password change error:", err);
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-container mb-2">
            <Icon name="lock" size={24} className="text-on-primary-container" />
          </div>
          <h1 className="text-headline-sm font-black text-on-surface">Secure Your Account</h1>
          <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
            An administrator has reset your password. For security, you must create a new personal password to continue.
          </p>
        </div>

        <Card variant="outlined" className="bg-white dark:bg-surface-container border border-outline-variant shadow-elevation-2 animate-in fade-in duration-300">
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-4 rounded-xl bg-error-container text-on-error-container text-body-sm font-medium flex items-center gap-2">
                <Icon name="error" size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <TextField
                label="New Password"
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
                <div className="p-4 rounded-xl bg-surface-dim/50 border border-outline-variant/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-bold text-on-surface">Password Strength:</span>
                    <span className={cn("text-label-sm font-bold px-2 py-0.5 rounded-full", strengthColor)}>
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-outline-variant rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-300", 
                        metCount >= 4 ? "bg-success" : metCount >= 3 ? "bg-warning" : "bg-error"
                      )}
                      style={{ width: `${(metCount / 5) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-body-xs font-medium">
                    <div className={cn("flex items-center gap-1", passwordCriteria.length ? "text-success" : "text-on-surface-variant")}>
                      <Icon name={passwordCriteria.length ? "check_circle" : "cancel"} size={14} />
                      8+ Characters
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.upper ? "text-success" : "text-on-surface-variant")}>
                      <Icon name={passwordCriteria.upper ? "check_circle" : "cancel"} size={14} />
                      Uppercase
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.lower ? "text-success" : "text-on-surface-variant")}>
                      <Icon name={passwordCriteria.lower ? "check_circle" : "cancel"} size={14} />
                      Lowercase
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.number ? "text-success" : "text-on-surface-variant")}>
                      <Icon name={passwordCriteria.number ? "check_circle" : "cancel"} size={14} />
                      Number
                    </div>
                    <div className={cn("flex items-center gap-1", passwordCriteria.symbol ? "text-success" : "text-on-surface-variant")}>
                      <Icon name={passwordCriteria.symbol ? "check_circle" : "cancel"} size={14} />
                      Special Symbol
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
                icon="shield"
              >
                Change password & continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
