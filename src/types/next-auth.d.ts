import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    roleId: string;
    roleName: string;
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    branchId: string | null;
    branchName: string | null;
  }

  interface Session {
    user: User & {
      email: string;
      name: string;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    roleId: string;
    roleName: string;
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    branchId: string | null;
    branchName: string | null;
  }
}
