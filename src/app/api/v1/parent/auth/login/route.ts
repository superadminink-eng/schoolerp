import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getAdminAuth } from "@/lib/firebase-admin";
import crypto from "crypto";
import * as jose from "jose";

async function verifyFirebasePassword(email: string, password?: string): Promise<boolean> {
  if (!password) return false;
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_FIREBASE_API_KEY is not defined.");
      return false;
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    return res.ok;
  } catch (error) {
    console.error("Firebase auth REST API error:", error);
    return false;
  }
}

async function signToken(payload: any, secretString: string): Promise<string> {
  const secret = new TextEncoder().encode(secretString);
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .setIssuer("school-erp-auth")
    .setAudience("school-erp-parent-app")
    .setJti(crypto.randomUUID())
    .sign(secret);
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email) {
      return apiError("VALIDATION_ERROR", "Email is required", 400);
    }
    if (!password) {
      return apiError("VALIDATION_ERROR", "Password is required", 400);
    }

    // Normalized email
    const normEmail = email.toLowerCase().trim();

    // Check if the user already exists in DB
    let user = await prisma.user.findFirst({
      where: { email: normEmail },
      include: {
        role: true,
        branch: true,
        parent: {
          include: {
            children: {
              include: {
                student: {
                  include: {
                    enrollments: {
                      orderBy: { enrolledAt: "desc" },
                      take: 1,
                      include: {
                        section: {
                          include: {
                            class: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (user) {
      // Check if user is a parent
      if (!user.parent) {
        return apiError("FORBIDDEN", "User exists but is not linked to a parent profile.", 403);
      }

      // Check if user is active
      if (!user.isActive) {
        return apiError("FORBIDDEN", "User account is suspended.", 403);
      }

      const isMockUser = user.firebaseUid.startsWith("parent-mock-");
      if (isMockUser) {
        // Provision Firebase account on-the-fly using the provided password
        const adminAuth = getAdminAuth();
        try {
          const fbUser = await adminAuth.createUser({
            email: normEmail,
            password: password,
            displayName: user.name,
          });
          await prisma.user.update({
            where: { id: user.id },
            data: { firebaseUid: fbUser.uid },
          });
          user.firebaseUid = fbUser.uid;
        } catch (err: any) {
          console.error("Failed to provision Firebase account on-the-fly for parent:", err);
          return apiError("SERVER_ERROR", "Authentication setup failed.", 500);
        }
      } else {
        // Verify credentials with Firebase Auth REST API
        const valid = await verifyFirebasePassword(normEmail, password);
        if (!valid) {
          return apiError("UNAUTHORIZED", "Invalid email or password", 401);
        }
      }
    } else {
      // User does not exist, check if there are matching students
      const matchingStudents = await prisma.student.findMany({
        where: {
          OR: [
            { fatherEmail: normEmail },
            { motherEmail: normEmail },
          ],
        },
        include: {
          enrollments: {
            orderBy: { enrolledAt: "desc" },
            take: 1,
            include: {
              section: {
                include: {
                  class: true,
                },
              },
            },
          },
        },
      });

      if (matchingStudents.length === 0) {
        return apiError("NOT_FOUND", "No student records found with this parent email.", 404);
      }

      // Dynamically provision Firebase account and Parent User account.
      const parentRole = await prisma.role.findFirst({
        where: { name: "PARENT" },
      });

      if (!parentRole) {
        return apiError("SERVER_ERROR", "PARENT role is not configured in the system.", 500);
      }

      const targetStudent = matchingStudents[0];
      const branch = await prisma.branch.findUnique({
        where: { id: targetStudent.branchId },
        select: { organizationId: true },
      });

      if (!branch) {
        return apiError("SERVER_ERROR", "Could not determine organization context from student branch.", 500);
      }

      const isFather = targetStudent.fatherEmail?.toLowerCase() === normEmail;
      const parentName = isFather
        ? targetStudent.fatherName || "Father"
        : targetStudent.motherName || "Mother";

      // Create Firebase Auth account
      const adminAuth = getAdminAuth();
      let fbUser;
      try {
        fbUser = await adminAuth.createUser({
          email: normEmail,
          password: password,
          displayName: parentName,
        });
      } catch (err: any) {
        if (err.code === "auth/email-already-exists") {
          return apiError("CONFLICT", "Email is already registered in the auth system", 409);
        }
        console.error("Firebase parent createUser error:", err);
        return apiError("INTERNAL_ERROR", "Failed to create auth account", 500);
      }

      user = await prisma.user.create({
        data: {
          organizationId: branch.organizationId,
          branchId: targetStudent.branchId,
          firebaseUid: fbUser.uid,
          email: normEmail,
          name: parentName,
          roleId: parentRole.id,
          isActive: true,
        },
        include: {
          role: true,
          branch: true,
          parent: {
            include: {
              children: {
                include: {
                  student: {
                    include: {
                      enrollments: {
                        orderBy: { enrolledAt: "desc" },
                        take: 1,
                        include: {
                          section: {
                            include: {
                              class: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const newParent = await prisma.parent.create({
        data: {
          userId: user.id,
          relationship: isFather ? "FATHER" : "MOTHER",
        },
      });

      for (const student of matchingStudents) {
        await prisma.studentParent.create({
          data: {
            studentId: student.id,
            parentId: newParent.id,
            relation: isFather ? "FATHER" : "MOTHER",
            isPrimary: true,
          },
        });
      }

      // Reload user
      const reloadedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          role: true,
          branch: true,
          parent: {
            include: {
              children: {
                include: {
                  student: {
                    include: {
                      enrollments: {
                        orderBy: { enrolledAt: "desc" },
                        take: 1,
                        include: {
                          section: {
                            include: {
                              class: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (reloadedUser) {
        user = reloadedUser;
      }
    }

    if (!user || !user.parent) {
      return apiError("FORBIDDEN", "User exists but is not linked to a parent profile.", 403);
    }

    // Construct response children list
    const childrenList = user.parent.children.map((link) => {
      const student = link.student;
      const latestEnrollment = student.enrollments[0];
      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
        rollNo: student.rollNo || latestEnrollment?.rollNo || "N/A",
        class: latestEnrollment?.section?.class?.name || "N/A",
        section: latestEnrollment?.section?.name || "N/A",
        gender: student.gender,
        bloodGroup: student.bloodGroup || "N/A",
      };
    });

    const secret = process.env.AUTH_SECRET || "auth_secret_fallback";
    const token = await signToken({ userId: user.id, role: "PARENT", parentId: user.parent.id }, secret);

    return apiSuccess({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "PARENT",
        branchId: user.branchId || "",
        branchName: user.branch?.name || "",
      },
      children: childrenList,
    });
  } catch (error: any) {
    console.error("Parent login error:", error);
    return apiError("SERVER_ERROR", "Internal server error: " + error.message, 500);
  }
}
