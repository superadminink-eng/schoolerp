import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jose from "jose";

async function verifyToken(token: string, secretString: string): Promise<any | null> {
  try {
    const secret = new TextEncoder().encode(secretString);
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: "school-erp-auth",
      audience: "school-erp-parent-app",
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

export async function getParentUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const rawToken = authHeader.substring(7).trim();
  if (!rawToken) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not configured.");
  }

  let userId: string | null = null;

  // Hardened Playwright E2E mock token bypass (explicit opt-in only)
  const allowMock = process.env.ALLOW_MOCK_AUTH === "true";
  if (allowMock && rawToken.startsWith("parent-mock-token-")) {
    userId = rawToken.replace("parent-mock-token-", "").trim();
  } else {
    // Secure JWT Verification
    const payload = await verifyToken(rawToken, secret);
    if (payload && payload.role === "PARENT") {
      userId = payload.userId as string;
    }
  }

  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        organization: { select: { isActive: true } },
        parent: {
          include: {
            children: {
              where: {
                student: { deletedAt: null },
              },
              select: {
                studentId: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.organization?.isActive) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error in getParentUser helper:", error);
    return null;
  }
}
