import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function verifyToken(token: string, secret: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  if (signature !== expectedSignature) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    // Reject expired tokens
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
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

  let userId: string | null = null;

  // Fallback for Playwright E2E tests in dev/test environment
  if (process.env.NODE_ENV !== "production" && rawToken.startsWith("parent-mock-token-")) {
    userId = rawToken.replace("parent-mock-token-", "").trim();
  } else {
    // Production / Secure Mode: decode and verify JWT
    const secret = process.env.AUTH_SECRET || "auth_secret_fallback";
    const payload = verifyToken(rawToken, secret);
    if (payload && payload.role === "PARENT") {
      userId = payload.userId;
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
