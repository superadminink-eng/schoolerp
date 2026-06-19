"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AuthErrorAlert } from "./auth-error-alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email address.")
    .email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

type LoginSchema = z.infer<typeof loginSchema>;

function isSafeUrl(url: string | null): boolean {
  if (!url) return false;
  
  // Must start with '/' and not '//' or '\'
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\") || url.startsWith("\\")) {
    return false;
  }
  
  // Client-side strict URL origin verification
  if (typeof window !== "undefined") {
    try {
      const resolved = new URL(url, window.location.origin);
      return resolved.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  
  // Server-side / fallback: strict regex for relative paths (allows letters, numbers, sub-paths, search params, and hash)
  // Prevents control characters, domains, and protocol overrides.
  const relativeRegex = /^\/[a-zA-Z0-9\-_/]*(\?[a-zA-Z0-9\-_&=%]*)?(#[a-zA-Z0-9\-_]*)?$/;
  return relativeRegex.test(url);
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const callbackUrlParam = searchParams.get("callbackUrl");
  const callbackUrl = isSafeUrl(callbackUrlParam) ? callbackUrlParam! : "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Proactively clear any leftover Firebase client session on mount (Google/Meta standard cleanup)
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          await firebaseSignOut(firebaseAuth);
        } catch (err) {
          console.error("Failed to clear leftover Firebase session on mount:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleFirebaseSignIn(idToken: string) {
    const result = await signIn("firebase", {
      idToken,
      redirect: false,
    });

    if (result?.error) {
      setError("Account not found or inactive. Contact your administrator.");
      // Clean up Firebase client-side session on NextAuth server-side failure
      try {
        await firebaseSignOut(firebaseAuth);
      } catch (signOutErr) {
        console.error("Firebase client sign out error:", signOutErr);
      }
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function onSubmit(data: LoginSchema) {
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        data.email,
        data.password
      );
      const idToken = await credential.user.getIdToken();
      await handleFirebaseSignIn(idToken);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      switch (firebaseError.code) {
        case "auth/user-not-found":
          setError("No account found with this email.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password. Please try again.");
          break;
        case "auth/invalid-credential":
          setError("Invalid email or password.");
          break;
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;
        case "auth/user-disabled":
          setError(
            "This account has been disabled. Contact your administrator."
          );
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.");
          break;
        case "auth/network-request-failed":
          setError("Network error. Please check your connection.");
          break;
        default:
          setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card variant="outlined">
        <CardContent className="p-6">
          <form onSubmit={handleFormSubmit(onSubmit)}>
            <AuthErrorAlert message={error} />

            <div className="flex flex-col gap-5">
              <TextField
                label="Email"
                type="email"
                leadingIcon="mail"
                required
                fullWidth
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />

              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                leadingIcon="lock"
                trailingIcon={showPassword ? "visibility_off" : "visibility"}
                onTrailingIconClick={() => setShowPassword(!showPassword)}
                required
                fullWidth
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password")}
              />
            </div>

            <div className="flex justify-end mt-2 mb-6">
              <Link
                href="/forgot-password"
                className="text-[14px] leading-5 font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="filled"
              fullWidth
              loading={loading}
              icon="login"
            >
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center mt-6 text-body-md text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-primary font-medium hover:underline"
        >
          Register here
        </Link>
      </p>
    </>
  );
}
