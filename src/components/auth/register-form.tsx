"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import Link from "next/link";
import { AuthErrorAlert } from "./auth-error-alert";

export function RegisterForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    schoolName: "",
    adminName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        form.email,
        form.password
      );

      await updateProfile(credential.user, { displayName: form.adminName });
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/v1/organizations/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          schoolName: form.schoolName,
          adminName: form.adminName,
          email: form.email,
          phone: form.phone,
          firebaseUid: credential.user.uid,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? "Registration failed.");
        return;
      }

      router.push("/login?registered=true");
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card variant="outlined">
        <CardContent className="p-6">
          <AuthErrorAlert message={error} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="School / Institution Name"
              value={form.schoolName}
              onChange={(e) => updateField("schoolName", e.target.value)}
              leadingIcon="domain"
              required
              fullWidth
            />

            <Divider className="my-2" />

            <TextField
              label="Administrator Name"
              value={form.adminName}
              onChange={(e) => updateField("adminName", e.target.value)}
              leadingIcon="person"
              required
              fullWidth
            />

            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              leadingIcon="mail"
              required
              fullWidth
              autoComplete="email"
            />

            <TextField
              label="Phone Number"
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              leadingIcon="call"
              fullWidth
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              leadingIcon="lock"
              trailingIcon={showPassword ? "visibility_off" : "visibility"}
              onTrailingIconClick={() => setShowPassword(!showPassword)}
              helperText="At least 8 characters"
              required
              fullWidth
            />

            <TextField
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              leadingIcon="lock"
              required
              fullWidth
            />

            <Button
              type="submit"
              variant="filled"
              fullWidth
              loading={loading}
              icon="app_registration"
            >
              Create Account
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center mt-6 text-body-md text-on-surface-variant">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
