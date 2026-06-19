"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { AuthErrorAlert } from "./auth-error-alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const recoverySchema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address."),
});

type RecoverySchema = z.infer<typeof recoverySchema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Handle active countdown for resending (spam protection)
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const {
    register,
    handleSubmit: handleFormSubmit,
    getValues,
    formState: { errors },
  } = useForm<RecoverySchema>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      email: "",
    },
  });

  async function performRecoveryRequest(emailAddress: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to send reset email.");
      }
      
      setSent(true);
      setCountdown(60); // lock resend for 60s
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(err.message || "Failed to send reset email. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(data: RecoverySchema) {
    await performRecoveryRequest(data.email);
  }

  async function handleResend() {
    if (countdown > 0) return;
    const currentEmail = getValues("email");
    await performRecoveryRequest(currentEmail);
  }

  return (
    <>
      <Card className="border border-slate-200/40 dark:border-slate-800/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl shadow-slate-100/30 dark:shadow-none rounded-2xl overflow-hidden">
        <CardContent className="p-6 md:p-8">
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/40 text-primary mb-2 shadow-inner">
                <Icon
                  name="check_circle"
                  size={24}
                  className="text-primary animate-pulse"
                />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">Check your email</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                  If an account is associated with <strong className="text-slate-800 dark:text-slate-200">{getValues("email")}</strong>, we have sent a secure password reset link. Please check your inbox.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2 items-center">
                <Button 
                  variant="text" 
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  className="text-xs font-bold text-primary hover:bg-slate-50 dark:hover:bg-slate-800/40 border-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {countdown > 0 ? `Send again in ${countdown}s` : "Send again"}
                </Button>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer bg-transparent border-none"
                >
                  Change email address
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {error && <AuthErrorAlert message={error} />}

              <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-5">
                <TextField
                  label="Email Address"
                  type="email"
                  variant="compact"
                  leadingIcon="mail"
                  required
                  fullWidth
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register("email")}
                />

                <Button
                  type="submit"
                  variant="filled"
                  fullWidth
                  loading={loading}
                  icon="send"
                  className="h-10 text-xs font-bold uppercase tracking-wider bg-primary text-white rounded-lg transition-transform active:scale-98 shadow-sm cursor-pointer border-none"
                >
                  Send Reset Link
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center mt-6 text-xs text-slate-550 dark:text-slate-400 font-medium">
        Remember your password?{" "}
        <Link
          href="/login"
          className="text-primary font-bold hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
