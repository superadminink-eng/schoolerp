# Security Audit: School ERP

&nbsp;

**Date:** June 18, 2026
**Auditor Role:** Senior Application Security Engineer / OWASP Specialist
**Scope:** Full application security review
**Standards:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023)
**Repository:** School ERP (Next.js 15 / Prisma / Firebase / MySQL)

&nbsp;

---

&nbsp;

## Table of Contents

&nbsp;

1. [Executive Summary](#1-executive-summary)
2. [Critical Findings](#2-critical-findings)
3. [High Severity Findings](#3-high-severity-findings)
4. [Medium Severity Findings](#4-medium-severity-findings)
5. [Low Severity Findings](#5-low-severity-findings)
6. [OWASP Top 10 Mapping](#6-owasp-top-10-mapping)
7. [OWASP API Security Top 10 Mapping](#7-owasp-api-security-top-10-mapping)
8. [Positive Security Controls](#8-positive-security-controls)
9. [Prioritized Remediation Plan](#9-prioritized-remediation-plan)
10. [Summary Scorecard](#10-summary-scorecard)

&nbsp;

---

&nbsp;

## 1. Executive Summary

&nbsp;

The School ERP system was audited across authentication, authorization, input validation, API security, secrets management, and file upload handling. The audit identified **27 findings**: 6 Critical, 8 High, 8 Medium, and 5 Low severity issues.

&nbsp;

The most severe issues center around the **parent portal authentication subsystem**, which uses a custom JWT implementation with a hardcoded fallback secret, no token expiration, and a mock-token bypass that could be active in non-production deployments. Cross-organization data access (IDOR) is possible through the parent dashboard endpoint. The main application authentication (Firebase + NextAuth) is significantly more robust.

&nbsp;

| Severity | Count |
|:---------|:------|
| Critical | 6     |
| High     | 8     |
| Medium   | 8     |
| Low      | 5     |
| **Total** | **27** |

&nbsp;

---

&nbsp;

## 2. Critical Findings

&nbsp;

### SEC-01: Hardcoded JWT Secret Fallback

&nbsp;

**Severity:** CRITICAL
**OWASP:** A07:2021 — Identification and Authentication Failures
**Files:**

- `src/app/api/v1/parent/auth/login/route.ts:300`
- `src/app/api/v1/parent/parent-auth.ts:34`

&nbsp;

**Vulnerable Code:**

```typescript
const secret = process.env.AUTH_SECRET || "auth_secret_fallback";
const token = signToken({ userId: user.id, role: "PARENT", parentId: user.parent.id }, secret);
```

&nbsp;

**Exploit Scenario:**
If `AUTH_SECRET` is not set in the environment (deployment oversight, missing Vercel env var), the system falls back to the publicly visible string `"auth_secret_fallback"`. An attacker who reads the source code can forge valid JWT tokens for any parent user, gaining access to student records, fee data, attendance, and exam results across all organizations.

&nbsp;

**Impact:** Complete authentication bypass for the parent portal. Any parent account can be impersonated.

&nbsp;

**Fix:** Remove the fallback. Fail hard if the secret is missing.

```typescript
const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("AUTH_SECRET environment variable is required");
```

&nbsp;

---

&nbsp;

### SEC-02: Custom JWT Implementation Without Expiration

&nbsp;

**Severity:** CRITICAL
**OWASP:** A07:2021 — Identification and Authentication Failures
**File:** `src/app/api/v1/parent/auth/login/route.ts:27-31`

&nbsp;

**Vulnerable Code:**

```typescript
function signToken(payload: any, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}
```

&nbsp;

**Issues:**

- Custom cryptographic implementation instead of a vetted library (jsonwebtoken, jose)
- No `exp` (expiration) claim — tokens are valid forever
- No `iat` (issued-at) or `nbf` (not-before) claims
- No key rotation mechanism
- Uses `any` type for payload — no schema enforcement
- Timing-vulnerable string comparison on signature verification (`===` in `parent-auth.ts:10`)

&nbsp;

**Exploit Scenario:**
A stolen parent JWT token grants permanent access. There is no way to expire or revoke it short of rotating the `AUTH_SECRET`, which would invalidate every parent's token simultaneously.

&nbsp;

**Impact:** Permanent session hijacking. No token revocation possible.

&nbsp;

**Fix:** Replace with `jose` or `jsonwebtoken` library. Add `exp` claim (e.g., 24 hours). Use `crypto.timingSafeEqual()` for signature comparison.

&nbsp;

---

&nbsp;

### SEC-03: Mock Token Authentication Bypass

&nbsp;

**Severity:** CRITICAL
**OWASP:** A07:2021 — Identification and Authentication Failures
**File:** `src/app/api/v1/parent/parent-auth.ts:30-31`

&nbsp;

**Vulnerable Code:**

```typescript
if (process.env.NODE_ENV !== "production" && rawToken.startsWith("parent-mock-token-")) {
  userId = rawToken.replace("parent-mock-token-", "").trim();
}
```

&nbsp;

**Exploit Scenario:**
If `NODE_ENV` is not explicitly set to `"production"` (common in staging, preview deployments, or misconfigured Vercel environments), any request with `Authorization: Bearer parent-mock-token-<any-user-id>` bypasses all JWT verification. The attacker only needs to know or guess a valid user ID (UUIDs, but enumerable via other endpoints).

&nbsp;

**Impact:** Complete authentication bypass on any non-production deployment.

&nbsp;

**Fix:** Remove mock token logic from application code entirely. Use a dedicated test harness or environment-specific middleware that is never deployed.

&nbsp;

---

&nbsp;

### SEC-04: Cross-Organization IDOR in Parent Student Lookup

&nbsp;

**Severity:** CRITICAL
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/app/api/v1/parent/auth/login/route.ts:119-143`

&nbsp;

**Vulnerable Code:**

```typescript
const matchingStudents = await prisma.student.findMany({
  where: {
    OR: [
      { fatherEmail: normEmail },
      { motherEmail: normEmail },
    ],
  },
  // No organizationId filter
});
```

&nbsp;

**Exploit Scenario:**
The parent login endpoint searches for students across ALL organizations by email. An attacker can:

1. Call `POST /api/v1/parent/auth/login` with `email=victim@example.com`
2. If a student in ANY organization has that email as fatherEmail or motherEmail, the system returns student data and auto-provisions a parent account
3. The attacker now has legitimate access to another organization's student records

&nbsp;

**Impact:** Cross-tenant data breach. Student PII (names, admission numbers, classes, blood groups) exposed across organizations.

&nbsp;

**Fix:** Require an organization identifier in the parent login flow, or scope the student search to the organization the parent is attempting to log into.

&nbsp;

---

&nbsp;

### SEC-05: Account Enumeration via Differentiated Error Messages

&nbsp;

**Severity:** CRITICAL
**OWASP:** A07:2021 — Identification and Authentication Failures
**Files:**

- `src/components/auth/login-form.tsx:67-71`
- `src/components/auth/forgot-password-form.tsx:30-35`
- `src/app/api/v1/parent/auth/login/route.ts:141-142`

&nbsp;

**Vulnerable Code (login-form.tsx):**

```typescript
case "auth/user-not-found":
  setError("No account found with this email.");
  break;
case "auth/wrong-password":
  setError("Incorrect password. Please try again.");
  break;
```

&nbsp;

**Vulnerable Code (parent login):**

```typescript
if (matchingStudents.length === 0) {
  return apiError("NOT_FOUND", "No student records found with this parent email.", 404);
}
```

&nbsp;

**Exploit Scenario:**
Attacker systematically submits login requests. "No account found" confirms the email is not registered; "Incorrect password" confirms it is. The parent endpoint returns 404 for unregistered emails and 401 for wrong passwords. This builds a list of valid emails for targeted attacks.

&nbsp;

**Impact:** Enables email harvesting for phishing, credential stuffing, and targeted attacks.

&nbsp;

**Fix:** Return a generic message for all authentication failures: "Invalid email or password."

&nbsp;

---

&nbsp;

### SEC-06: Verbose Error Messages Leak Internal Details

&nbsp;

**Severity:** CRITICAL
**OWASP:** A04:2021 — Insecure Design
**Files:**

- `src/app/api/v1/parent/auth/login/route.ts:317`
- `src/app/api/v1/parent/student/[studentId]/dashboard/route.ts:290`

&nbsp;

**Vulnerable Code:**

```typescript
return apiError("SERVER_ERROR", "Internal server error: " + error.message, 500);
```

&nbsp;

**Exploit Scenario:**
If a database connection fails, the error message includes the connection string. If Prisma throws a validation error, it includes schema details. These messages are returned directly to the client in the API response body.

&nbsp;

**Impact:** Exposes database structure, connection strings, file paths, and internal implementation details to attackers.

&nbsp;

**Fix:** Never concatenate `error.message` into API responses. Return a generic message and log the full error server-side.

```typescript
console.error("Parent login error:", error);
return apiError("SERVER_ERROR", "An unexpected error occurred", 500);
```

&nbsp;

---

&nbsp;

## 3. High Severity Findings

&nbsp;

### SEC-07: No Rate Limiting on Any Endpoint

&nbsp;

**Severity:** HIGH
**OWASP:** A07:2021 — Identification and Authentication Failures
**Files:** All API routes under `src/app/api/v1/`

&nbsp;

**Issue:** No rate limiting middleware exists anywhere in the codebase. Confirmed by searching for `rateLimit`, `rate-limit`, `throttle`, and `limiter` — zero results.

&nbsp;

**Affected Endpoints:**

- `POST /api/v1/parent/auth/login` — parent credential brute force
- `POST /login` (Firebase client) — brute force (Firebase has its own limits, but they are generous)
- `POST /api/v1/organizations/register` — account creation spam
- `POST /api/v1/auth/reset-password-sync` — reset code enumeration
- `POST /api/v1/profile/change-password` — password change abuse

&nbsp;

**Impact:** Brute force attacks, credential stuffing, account enumeration, and DoS are all unmitigated at the application layer.

&nbsp;

**Fix:** Implement rate limiting via Vercel Edge Middleware or `@upstash/ratelimit` with Redis. Apply strict limits (5 attempts/minute) on auth endpoints, moderate limits (30/minute) on data endpoints.

&nbsp;

---

&nbsp;

### SEC-08: Missing HTTP Security Headers

&nbsp;

**Severity:** HIGH
**OWASP:** A05:2021 — Security Misconfiguration
**File:** `next.config.ts` (no security headers configured)

&nbsp;

**Missing Headers:**

| Header                        | Status  | Risk                              |
|:------------------------------|:--------|:----------------------------------|
| Content-Security-Policy       | Missing | XSS, script injection             |
| X-Frame-Options               | Missing | Clickjacking                      |
| X-Content-Type-Options        | Missing | MIME type sniffing                 |
| Strict-Transport-Security     | Missing | SSL stripping                     |
| Referrer-Policy               | Missing | Information leakage via referrer   |
| Permissions-Policy            | Missing | Browser feature abuse              |

&nbsp;

**Impact:** The application is vulnerable to clickjacking, MIME sniffing attacks, and lacks HSTS enforcement.

&nbsp;

**Fix:** Add security headers in `next.config.ts` or via middleware:

```typescript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ],
  }];
}
```

&nbsp;

---

&nbsp;

### SEC-09: Branch Isolation Bypass via \_\_all\_\_ Parameter

&nbsp;

**Severity:** HIGH
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/app/api/v1/admissions/inquiries/route.ts:32-36` (and similar pattern in other routes)

&nbsp;

**Vulnerable Code:**

```typescript
if (ctx.branchId && branchId !== "__all__") {
  where.branchId = ctx.branchId;
} else if (branchId && branchId !== "ALL" && branchId !== "__all__") {
  where.branchId = branchId;
}
```

&nbsp;

**Exploit Scenario:**
A BRANCH_ADMIN with `ctx.branchId = "branch-1"` sends `GET /api/v1/admissions/inquiries?branchId=__all__`. The first condition evaluates to false (because `branchId === "__all__"`), so their branch restriction is not applied. The second condition also skips because of the `__all__` check. Result: no branch filter applied, and the BRANCH_ADMIN sees inquiries from all branches.

&nbsp;

**Impact:** Branch-scoped users can access data from other branches within the same organization.

&nbsp;

**Fix:** Enforce branch scoping unconditionally for branch-scoped roles:

```typescript
if (ctx.branchId && ctx.roleName === "BRANCH_ADMIN") {
  where.branchId = ctx.branchId; // Always enforce, ignore client parameter
}
```

&nbsp;

---

&nbsp;

### SEC-10: Role Assignment Without Organization Validation

&nbsp;

**Severity:** HIGH
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/app/api/v1/staff/[id]/route.ts:159-169`

&nbsp;

**Vulnerable Code:**

```typescript
const user = await prisma.user.create({
  data: {
    organizationId: ctx.organizationId,
    branchId: branchId || existing.branchId,
    firebaseUid: firebaseUser.uid,
    email,
    name: name || existing.name,
    roleId: roleId, // Taken directly from request, not validated against org
  }
});
```

&nbsp;

**Exploit Scenario:**
A SCHOOL_ADMIN from Organization A calls `PATCH /api/v1/staff/:id` with `createAccount: true` and `roleId` set to a system-level SUPER_ADMIN role ID (which has `organizationId: null`). The code creates a user in Organization A with SUPER_ADMIN privileges, bypassing the normal role hierarchy.

&nbsp;

**Impact:** Privilege escalation to SUPER_ADMIN.

&nbsp;

**Fix:** Validate that `roleId` belongs to the caller's organization, and reject system-level roles:

```typescript
const targetRole = await prisma.role.findFirst({
  where: { id: roleId, organizationId: ctx.organizationId },
});
if (!targetRole) return apiError("FORBIDDEN", "Invalid role", 403);
```

&nbsp;

---

&nbsp;

### SEC-11: Hardcoded Role Name Checks Bypass Permission System

&nbsp;

**Severity:** HIGH
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/app/api/v1/organizations/settings/route.ts:42-44`

&nbsp;

**Vulnerable Code:**

```typescript
if (ctx.roleName !== "SCHOOL_ADMIN" && ctx.roleName !== "SUPER_ADMIN") {
  return apiError("FORBIDDEN", "Only school administrators can access settings", 403);
}
```

&nbsp;

**Issue:** This bypasses the entire permission resolution system (`checkApiPermission`). If a BRANCH_ADMIN is granted `settings:manage` via a user-level permission override, they are still denied because the check is on role name, not permission.

&nbsp;

**Impact:** The RBAC system's user-level override feature is silently broken for these endpoints.

&nbsp;

**Fix:** Replace with `checkApiPermission(req, "settings", "manage")`.

&nbsp;

---

&nbsp;

### SEC-12: Overly Permissive OR-Based Permission Check on Roles Endpoint

&nbsp;

**Severity:** HIGH
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/app/api/v1/roles/route.ts:14-41`

&nbsp;

**Vulnerable Code:**

```typescript
const isAllowed =
  roleName === "SUPER_ADMIN" ||
  await hasPermission(userId, roleId, roleName, "settings", "manage") ||
  await hasPermission(userId, roleId, roleName, "staff", "read") ||
  await hasPermission(userId, roleId, roleName, "staff", "create") ||
  // ... many more
```

&nbsp;

**Exploit Scenario:**
A user with only `staff:read` permission (e.g., a LIBRARIAN) can access the roles endpoint, view all role definitions and their permission matrices. This is a sensitive system configuration endpoint that should require `settings:manage` or a dedicated `roles:read` permission.

&nbsp;

**Impact:** Unauthorized access to role and permission configuration data.

&nbsp;

**Fix:** Use a single `checkApiPermission(req, "roles", "read")` call.

&nbsp;

---

&nbsp;

### SEC-13: No CSRF Protection on Custom API Endpoints

&nbsp;

**Severity:** HIGH
**OWASP:** A01:2021 — Broken Access Control
**Files:** All `POST`/`PATCH`/`DELETE` routes under `src/app/api/v1/`

&nbsp;

**Issue:** NextAuth provides CSRF protection for its own endpoints, but custom API routes (students, staff, fees, etc.) accept POST/PATCH/DELETE requests authenticated only via the session cookie. No CSRF token is verified.

&nbsp;

**Exploit Scenario:**
If an attacker can get an authenticated user to visit a malicious page, the page can submit a form to `POST /api/v1/students` with the user's session cookie automatically attached by the browser. The student is created in the victim's organization.

&nbsp;

**Impact:** State-changing operations can be triggered by third-party websites.

&nbsp;

**Fix:** Implement CSRF token verification on all state-changing endpoints, or use `SameSite=Strict` cookies combined with custom header requirements (e.g., require `X-Requested-With: XMLHttpRequest`).

&nbsp;

---

&nbsp;

### SEC-14: Excessive Pagination Limit Enables Mass Data Exfiltration

&nbsp;

**Severity:** HIGH
**OWASP:** API6:2023 — Unrestricted Access to Sensitive Business Flows
**File:** `src/lib/api-helpers.ts:59`

&nbsp;

**Vulnerable Code:**

```typescript
limit = Math.min(10000, Math.max(1, parsedLimit));
```

&nbsp;

**Exploit Scenario:**
An authenticated user (even with minimal permissions like `students:read`) can request `GET /api/v1/students?limit=10000` and extract up to 10,000 student records with PII (names, phone numbers, dates of birth, addresses, fee data) in a single API call.

&nbsp;

**Impact:** Mass PII exfiltration with a single request.

&nbsp;

**Fix:** Reduce maximum limit to 100. Implement cursor-based pagination for large datasets.

&nbsp;

---

&nbsp;

## 4. Medium Severity Findings

&nbsp;

### SEC-15: Raw SQL Query in Fee Payment Handler

&nbsp;

**Severity:** MEDIUM
**OWASP:** A03:2021 — Injection
**File:** `src/app/api/v1/fees/[studentId]/route.ts:308-313`

&nbsp;

**Vulnerable Code:**

```typescript
let freshInvoices = await tx.$queryRaw<any[]>`
  SELECT id, totalAmount, paidAmount, lateFeeAccumulated, status, number
  FROM invoices
  WHERE studentId = ${studentId} AND status IN ('PENDING', 'PARTIAL', 'OVERDUE')
  ORDER BY dueDate ASC
  FOR UPDATE
`;
```

&nbsp;

**Issue:** Although Prisma's tagged template `$queryRaw` does parameterize values automatically, the use of `any[]` return type bypasses TypeScript safety. The `FOR UPDATE` row lock indicates this is used in a transactional context for fee payments, where correctness is critical.

&nbsp;

**Impact:** If the tagged template parameterization is ever bypassed (e.g., via string interpolation refactoring), SQL injection becomes possible. Using `any[]` means the return type is unvalidated.

&nbsp;

**Fix:** Replace with Prisma ORM query. If raw SQL is required for `FOR UPDATE`, use `Prisma.sql` helper with typed return.

&nbsp;

---

&nbsp;

### SEC-16: Missing Max Length on Notice Content Field

&nbsp;

**Severity:** MEDIUM
**OWASP:** API4:2023 — Unrestricted Resource Consumption
**File:** `src/lib/validations/notice.ts:8`

&nbsp;

**Vulnerable Code:**

```typescript
content: z.string().min(5, "Content must be at least 5 characters"),
// No .max() — unbounded input
```

&nbsp;

**Exploit Scenario:**
An authenticated admin sends a `POST /api/v1/notices` with a multi-megabyte `content` field. This is stored in a MySQL `LongText` column, consuming disk space and causing slow queries when notices are fetched.

&nbsp;

**Impact:** Disk exhaustion, performance degradation, potential DoS.

&nbsp;

**Fix:** Add `.max(10000)` or an appropriate upper bound.

&nbsp;

---

&nbsp;

### SEC-17: Weak Password Policy for Staff Accounts

&nbsp;

**Severity:** MEDIUM
**OWASP:** A07:2021 — Identification and Authentication Failures
**File:** `src/lib/validations/staff.ts:27-39`

&nbsp;

**Vulnerable Code:**

```typescript
.refine((data) => {
  if (data.createAccount && (!data.password || data.password.length < 6)) {
    return false;
  }
  return true;
}, {
  message: "Password must be at least 6 characters when creating an account",
})
```

&nbsp;

**Issue:** Staff passwords require only 6 characters with no complexity requirements. Compare to user accounts which require 8 characters (`src/lib/validations/user.ts:16`). Neither enforces uppercase, lowercase, digit, or symbol requirements.

&nbsp;

**Impact:** Weak passwords are easily brute-forced, especially given the absence of rate limiting (SEC-07).

&nbsp;

**Fix:** Enforce minimum 8 characters with complexity requirements (uppercase + lowercase + digit) consistently across all account types.

&nbsp;

---

&nbsp;

### SEC-18: Sensitive Error Details Logged to Console

&nbsp;

**Severity:** MEDIUM
**OWASP:** A09:2021 — Security Logging and Monitoring Failures
**Files:**

- `src/lib/auth.ts:61`
- `src/app/api/v1/parent/auth/login/route.ts:22, 107, 316`
- `src/app/api/v1/auth/reset-password-sync/route.ts:34`
- `src/app/api/v1/parent/parent-auth.ts:66`

&nbsp;

**Pattern:**

```typescript
console.error("Firebase token verification failed:", error);
console.error("Parent login error:", error);
```

&nbsp;

**Issue:** Unfiltered error objects are logged to console. In production (Vercel), these logs are stored in log aggregation services where they could be accessed by anyone with project access. Error objects may contain database connection strings, Firebase credentials, or user data.

&nbsp;

**Impact:** Credential and PII leakage via log storage.

&nbsp;

**Fix:** Use a structured logger (Pino, Winston) that sanitizes sensitive fields. Log only error codes and messages, never full error objects.

&nbsp;

---

&nbsp;

### SEC-19: Path Traversal Potential in File Upload

&nbsp;

**Severity:** MEDIUM
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/lib/upload.ts:137-191`

&nbsp;

**Vulnerable Code:**

```typescript
export async function saveUploadedImage(
  file: File,
  subDir: string,  // No validation
  prefix: string,
  purpose: ImagePurpose = "document"
): Promise<...> {
  const absoluteDir = path.join(process.cwd(), "public", subDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), processedBuffer);
}
```

&nbsp;

**Issue:** The `subDir` parameter is not validated for path traversal sequences (`../`). Currently, all callers pass hardcoded strings (`"uploads/student-photos"`, `"uploads/staff-documents"`), so this is not exploitable today. However, if any future code passes user-controlled input as `subDir`, files could be written outside the intended directory.

&nbsp;

**Impact:** Potential arbitrary file write if `subDir` becomes user-controlled.

&nbsp;

**Fix:** Add defensive validation inside `saveUploadedImage()`:

```typescript
if (subDir.includes("..") || path.isAbsolute(subDir)) {
  throw new UploadError("Invalid upload directory");
}
```

&nbsp;

---

&nbsp;

### SEC-20: Client-Side Permission Bypass via Role Name Check

&nbsp;

**Severity:** MEDIUM
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/hooks/use-permissions.tsx:84-85`

&nbsp;

**Vulnerable Code:**

```typescript
if (session?.user?.roleName === "SUPER_ADMIN" || session?.user?.roleName === "SCHOOL_ADMIN") {
  return true;
}
```

&nbsp;

**Issue:** The client-side `can()` function hardcodes admin role names, granting all permissions without checking the server. While server-side checks still enforce the real permissions, the UI renders all protected actions (delete buttons, admin panels) for these roles even if specific permissions were revoked.

&nbsp;

**Impact:** UI shows actions the user may not actually be authorized to perform. Creates confusion and false sense of access.

&nbsp;

**Fix:** Remove the client-side shortcut. Always check against the fetched permission set.

&nbsp;

---

&nbsp;

### SEC-21: Stale Permission Cache Without Invalidation

&nbsp;

**Severity:** MEDIUM
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/hooks/use-permissions.tsx:52-59`

&nbsp;

**Issue:** Permissions are cached in `sessionStorage` using a Stale-While-Revalidate pattern. When an admin revokes a user's permission, the user continues to see the revoked action in the UI until they refresh or the background fetch completes. There is no push-based invalidation mechanism.

&nbsp;

**Impact:** Delayed permission enforcement on the client. Users may attempt (and fail at) revoked actions.

&nbsp;

**Fix:** Add a `tokenVersion` or `permissionVersion` to the session JWT. Compare it against the cached version and force a refetch on mismatch.

&nbsp;

---

&nbsp;

### SEC-22: No Password Reuse Prevention

&nbsp;

**Severity:** MEDIUM
**OWASP:** A07:2021 — Identification and Authentication Failures
**File:** `src/app/api/v1/profile/change-password/route.ts`

&nbsp;

**Issue:** The password change endpoint does not verify that the new password differs from the current password. A user subject to `forcePasswordChange` can "change" their password to the same value, clearing the flag without actually improving security.

&nbsp;

**Impact:** Forced password change policy can be trivially bypassed.

&nbsp;

**Fix:** Hash and compare the new password against the current password before accepting the change.

&nbsp;

---

&nbsp;

## 5. Low Severity Findings

&nbsp;

### SEC-23: No Multi-Factor Authentication (MFA) Support

&nbsp;

**Severity:** LOW
**OWASP:** A07:2021 — Identification and Authentication Failures

&nbsp;

**Issue:** The system relies solely on email/password authentication via Firebase. No MFA (TOTP, SMS, WebAuthn) is implemented or offered, even for administrative roles like SUPER_ADMIN and SCHOOL_ADMIN.

&nbsp;

**Impact:** Admin accounts with access to all student PII are protected only by a single password.

&nbsp;

**Fix:** Enable Firebase MFA for administrative roles. Consider mandatory MFA for SUPER_ADMIN and SCHOOL_ADMIN.

&nbsp;

---

&nbsp;

### SEC-24: Organization Enumeration via Registration

&nbsp;

**Severity:** LOW
**OWASP:** A07:2021 — Identification and Authentication Failures
**File:** `src/app/api/v1/organizations/register/route.ts:48-54`

&nbsp;

**Vulnerable Code:**

```typescript
if (existingOrg) {
  return apiError("CONFLICT", "An organization with this email already exists", 409);
}
```

&nbsp;

**Impact:** Attackers can determine which emails are registered as organizations.

&nbsp;

**Fix:** Return a generic success message regardless of whether the organization exists.

&nbsp;

---

&nbsp;

### SEC-25: Fee Template Cross-Organization Risk

&nbsp;

**Severity:** LOW
**OWASP:** A01:2021 — Broken Access Control
**File:** `src/app/api/v1/admissions/applications/[id]/promote/route.ts:210-212`

&nbsp;

**Vulnerable Code:**

```typescript
const matchedTemplates = await tx.feeInstallmentTemplate.findMany({
  where: { id: { in: templateIds } },
  // No organizationId filter
});
```

&nbsp;

**Impact:** An attacker could theoretically apply a fee template from another organization during admission promotion, if they know the template ID.

&nbsp;

**Fix:** Add `organizationId: ctx.organizationId` to the where clause.

&nbsp;

---

&nbsp;

### SEC-26: Timing Attack in Idempotency Key Polling

&nbsp;

**Severity:** LOW
**OWASP:** A04:2021 — Insecure Design
**File:** `src/lib/idempotency.ts:76-106`

&nbsp;

**Issue:** The polling interval is a fixed 200ms with 15 iterations. An attacker can infer server processing time by measuring how quickly a "HIT" response returns vs. the 409 CONFLICT timeout.

&nbsp;

**Impact:** Timing side-channel reveals server load and processing characteristics.

&nbsp;

**Fix:** Add jitter to the polling interval.

&nbsp;

---

&nbsp;

### SEC-27: Validation Error Details Expose Schema Structure

&nbsp;

**Severity:** LOW
**OWASP:** A04:2021 — Insecure Design
**File:** `src/lib/api-helpers.ts:26-30`

&nbsp;

**Code:**

```typescript
export function apiValidationError(error: ZodError) {
  const details = error.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
  return apiError("VALIDATION_ERROR", "Invalid request data", 422, details);
}
```

&nbsp;

**Issue:** Validation error responses reveal field names and expected types, allowing attackers to map the API schema without documentation.

&nbsp;

**Impact:** Information disclosure. Aids in crafting targeted attacks.

&nbsp;

**Fix:** In production, return only the first validation error or a generic message. Avoid leaking all field names.

&nbsp;

---

&nbsp;

## 6. OWASP Top 10 Mapping

&nbsp;

| OWASP Category                                    | Findings          | Severity       |
|:--------------------------------------------------|:------------------|:---------------|
| A01:2021 — Broken Access Control                  | SEC-04, 09, 10, 11, 12, 13, 14, 19, 20, 21, 25 | CRIT to MED |
| A02:2021 — Cryptographic Failures                 | SEC-01, 02        | CRITICAL       |
| A03:2021 — Injection                              | SEC-15            | MEDIUM         |
| A04:2021 — Insecure Design                        | SEC-06, 26, 27    | CRIT to LOW    |
| A05:2021 — Security Misconfiguration              | SEC-08            | HIGH           |
| A06:2021 — Vulnerable Components                  | Not assessed      | —              |
| A07:2021 — Identification and Auth Failures       | SEC-01, 02, 03, 05, 07, 17, 22, 23, 24 | CRIT to LOW |
| A08:2021 — Software and Data Integrity Failures   | SEC-13 (CSRF)     | HIGH           |
| A09:2021 — Security Logging and Monitoring         | SEC-18            | MEDIUM         |
| A10:2021 — Server-Side Request Forgery            | Not found         | —              |

&nbsp;

---

&nbsp;

## 7. OWASP API Security Top 10 Mapping

&nbsp;

| OWASP API Category                                           | Findings       | Severity       |
|:-------------------------------------------------------------|:---------------|:---------------|
| API1:2023 — Broken Object Level Authorization                | SEC-04, 25     | CRITICAL       |
| API2:2023 — Broken Authentication                            | SEC-01, 02, 03, 05 | CRITICAL   |
| API3:2023 — Broken Object Property Level Authorization       | SEC-10         | HIGH           |
| API4:2023 — Unrestricted Resource Consumption                | SEC-07, 14, 16 | HIGH to MED    |
| API5:2023 — Broken Function Level Authorization              | SEC-09, 11, 12 | HIGH           |
| API6:2023 — Unrestricted Access to Sensitive Business Flows  | SEC-14         | HIGH           |
| API7:2023 — Server Side Request Forgery                      | Not found      | —              |
| API8:2023 — Security Misconfiguration                        | SEC-08         | HIGH           |
| API9:2023 — Improper Inventory Management                    | SEC-03 (mock)  | CRITICAL       |
| API10:2023 — Unsafe Consumption of APIs                      | Not found      | —              |

&nbsp;

---

&nbsp;

## 8. Positive Security Controls

&nbsp;

The following security controls are correctly implemented and should be maintained:

&nbsp;

| Control                                | Implementation                                  | File                          |
|:---------------------------------------|:-------------------------------------------------|:------------------------------|
| Tenant header spoofing prevention      | Middleware strips all x-* headers before inject  | `src/middleware.ts:30-38`     |
| Consistent organizationId scoping      | All main API queries filtered by org ID          | All routes under `api/v1/`    |
| Prisma ORM parameterized queries       | Prevents SQL injection by default                | All route handlers            |
| Soft-delete integrity                  | Prisma extensions intercept delete operations    | `src/lib/prisma.ts:8-187`    |
| File upload magic byte validation      | Binary header check prevents MIME type spoofing  | `src/lib/upload.ts:9-39`     |
| Forced WebP conversion                 | Prevents executable file uploads                 | `src/lib/upload.ts:181`      |
| File size limit (2MB)                  | Rejects oversized uploads                        | `src/lib/upload.ts:148`      |
| React auto-XSS-escaping               | No dangerouslySetInnerHTML with user content     | All React components          |
| Idempotency key system                 | Prevents duplicate mutations                     | `src/lib/idempotency.ts`     |
| Instant account revocation             | checkApiPermission verifies user.isActive        | `src/lib/rbac.ts`            |
| JWT token version tracking             | tokenVersion increment on password reset         | `src/lib/auth.config.ts`     |
| Forced password change flow            | Middleware redirects until password is changed    | `src/middleware.ts:57-63`    |
| Audit logging                          | Fire-and-forget action log for compliance        | `src/lib/audit.ts`           |

&nbsp;

---

&nbsp;

## 9. Prioritized Remediation Plan

&nbsp;

### Immediate (Week 1) — Critical Fixes

&nbsp;

| Priority | Finding | Action                                                                                    |
|:---------|:--------|:------------------------------------------------------------------------------------------|
| P0       | SEC-01  | Remove `"auth_secret_fallback"` — fail if `AUTH_SECRET` is not set                        |
| P0       | SEC-02  | Replace custom JWT with `jose` library, add `exp` claim (24h), use `timingSafeEqual`      |
| P0       | SEC-03  | Remove mock token logic from `parent-auth.ts` — use test-only middleware instead           |
| P0       | SEC-04  | Add `organizationId` filter to parent login student lookup                                |
| P0       | SEC-05  | Return generic "Invalid email or password" for all auth failures                          |
| P0       | SEC-06  | Replace `error.message` concatenation with generic error string in all catch blocks        |

&nbsp;

### Short Term (Week 2-3) — High Fixes

&nbsp;

| Priority | Finding | Action                                                                                    |
|:---------|:--------|:------------------------------------------------------------------------------------------|
| P1       | SEC-07  | Implement rate limiting via `@upstash/ratelimit` or Vercel WAF                            |
| P1       | SEC-08  | Add security headers via `next.config.ts` `headers()` function                            |
| P1       | SEC-09  | Enforce branch scoping unconditionally for BRANCH_ADMIN roles                             |
| P1       | SEC-10  | Validate `roleId` belongs to caller's org, reject system roles                            |
| P1       | SEC-11  | Replace all hardcoded role name checks with `checkApiPermission()` calls                  |
| P1       | SEC-12  | Replace OR-based permission checks with single `checkApiPermission()` calls               |
| P1       | SEC-13  | Add CSRF token verification or SameSite=Strict cookie policy                              |
| P1       | SEC-14  | Reduce max pagination limit from 10,000 to 100                                            |

&nbsp;

### Medium Term (Week 4-6) — Medium Fixes

&nbsp;

| Priority | Finding | Action                                                                                    |
|:---------|:--------|:------------------------------------------------------------------------------------------|
| P2       | SEC-15  | Replace `$queryRaw` with Prisma ORM `.findMany()` with typed return                      |
| P2       | SEC-16  | Add `.max(10000)` to notice `content` field in Zod schema                                 |
| P2       | SEC-17  | Enforce 8-character minimum + complexity requirements for all account types                |
| P2       | SEC-18  | Adopt structured logger (Pino), sanitize error objects before logging                     |
| P2       | SEC-19  | Add path traversal validation in `saveUploadedImage()` for `subDir`                       |
| P2       | SEC-20  | Remove hardcoded admin bypass in client-side `can()` function                             |
| P2       | SEC-21  | Add permission version tracking to force cache invalidation on changes                    |
| P2       | SEC-22  | Verify new password differs from current password before accepting change                 |

&nbsp;

### Long Term (Month 2+) — Low Fixes and Hardening

&nbsp;

| Priority | Finding | Action                                                                                    |
|:---------|:--------|:------------------------------------------------------------------------------------------|
| P3       | SEC-23  | Implement Firebase MFA for admin roles                                                    |
| P3       | SEC-24  | Return generic response for org registration regardless of email existence                |
| P3       | SEC-25  | Add `organizationId` filter to fee template lookup in admission promotion                 |
| P3       | SEC-26  | Add random jitter to idempotency polling interval                                         |
| P3       | SEC-27  | Reduce validation error verbosity in production (single field, generic message)            |

&nbsp;

---

&nbsp;

## 10. Summary Scorecard

&nbsp;

| Security Domain            | Score  | Key Issues                                                  |
|:---------------------------|:-------|:------------------------------------------------------------|
| Authentication             | 3/10   | Custom JWT, hardcoded secret, mock bypass, no MFA           |
| Authorization              | 5/10   | Good RBAC foundation, but bypasses via role names and \_\_all\_\_ |
| Input Validation           | 7/10   | Zod schemas solid, one missing max length, one raw SQL      |
| API Security               | 3/10   | No rate limiting, no CSRF, 10K pagination, verbose errors   |
| Secrets Management         | 4/10   | Hardcoded fallback secret, sensitive console.error logging  |
| File Upload Security       | 8/10   | Magic byte check, forced WebP, size limit — defensive path traversal missing |
| Security Headers           | 1/10   | No CSP, no X-Frame-Options, no HSTS, no Referrer-Policy    |
| Logging and Monitoring     | 3/10   | Unstructured console.error, no sanitization, no alerting    |

&nbsp;

### Overall Security Score: 4.2 / 10

&nbsp;

The main application (Firebase + NextAuth) has a reasonable security posture with proper tenant isolation, RBAC, and input validation via Prisma ORM. However, the parent portal subsystem introduces critical vulnerabilities through its custom JWT implementation, hardcoded secrets, and cross-organization data access. The absence of rate limiting, security headers, and CSRF protection across the entire API surface represents systemic risk. Immediate remediation of the 6 critical findings is essential before any further feature development.
