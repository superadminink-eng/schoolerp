import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    roleId: string;
    roleName: string;
    roleType: string;
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    organizationLogo?: string | null;
    branchId: string | null;
    branchName: string | null;
    forcePasswordChange: boolean;
    tokenVersion: number;
    organizationIsSetupComplete: boolean;
  }

  interface Session {
    user: User & {
      email: string;
      name: string;
      image?: string | null;
      forcePasswordChange: boolean;
      tokenVersion: number;
      organizationIsSetupComplete: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    roleId: string;
    roleName: string;
    roleType: string;
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    organizationLogo?: string | null;
    branchId: string | null;
    branchName: string | null;
    forcePasswordChange?: boolean;
    tokenVersion?: number;
    organizationIsSetupComplete?: boolean;
  }
}
