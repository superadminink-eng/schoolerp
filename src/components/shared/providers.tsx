"use client";

import { SessionProvider } from "next-auth/react";
import { SnackbarProvider } from "@/components/ui/snackbar";

interface ProvidersProps {
  children: React.ReactNode;
  session?: any;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session} key={session?.user?.id}>
      <SnackbarProvider>{children}</SnackbarProvider>
    </SessionProvider>
  );
}
