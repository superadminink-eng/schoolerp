# Architecture Audit: School ERP

&nbsp;

**Date:** June 18, 2026
**Auditor Role:** Principal Software Architect
**Scope:** Architecture only (excludes security, performance, and code quality reviews)
**Repository:** School ERP (Next.js 15 / TypeScript / Prisma / MySQL / Firebase)

&nbsp;

---

&nbsp;

## Table of Contents

&nbsp;

1. [Architecture Diagram](#1-architecture-diagram)
2. [Technology Stack Identification](#2-technology-stack-identification)
3. [Architecture Review](#3-architecture-review)
4. [Findings](#4-findings)
5. [Architecture Score](#5-architecture-score)

&nbsp;

---

&nbsp;

## 1. Architecture Diagram

&nbsp;

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ Firebase  │  │  React 19    │  │  AG Grid   │  │  Radix UI    │ │
│  │ Client SDK│  │  (CSR Only)  │  │  DataTable │  │  Primitives  │ │
│  └─────┬─────┘  └──────┬───────┘  └────────────┘  └──────────────┘ │
│        │               │                                            │
│        │    ┌──────────┴──────────┐                                │
│        │    │  useState + fetch() │  ← No SWR / React Query        │
│        │    │  (per-page state)   │                                │
│        │    └──────────┬──────────┘                                │
└────────┼───────────────┼────────────────────────────────────────────┘
         │               │
    Firebase ID Token     │  HTTP (JSON / FormData)
         │               │
┌────────▼───────────────▼────────────────────────────────────────────┐
│                    EDGE MIDDLEWARE (src/middleware.ts)                │
│                                                                     │
│  1. Strip spoofed x-* headers                                      │
│  2. Verify JWT session (NextAuth v5)                                │
│  3. Enforce force-password-change / onboarding                     │
│  4. Inject tenant headers: x-organization-id, x-user-id,          │
│     x-user-role-id, x-user-role-name, x-branch-id                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                  NEXT.JS 15 APP ROUTER (Node.js)                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Route Groups                                                │   │
│  │                                                              │   │
│  │  (auth)/          → Login, Register, Forgot/Reset Password  │   │
│  │  (dashboard)/     → All protected pages (layout.tsx = SSR)  │   │
│  │  (marketing)/     → Public pages                            │   │
│  │  api/auth/        → NextAuth catch-all                      │   │
│  │  api/v1/          → REST API (~51 route files)              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Route Handler (typical)                                  │  │
│  │                                                               │  │
│  │  checkApiPermission() ──► getTenantContext() ──► Zod Parse   │  │
│  │         │                        │                    │       │  │
│  │         ▼                        ▼                    ▼       │  │
│  │  rbac.ts (DB call)      Header extraction     validations/*  │  │
│  │                                                       │       │  │
│  │         ┌─────────────────────────────────────────────┘       │  │
│  │         ▼                                                     │  │
│  │  ┌──────────────────────────────────────────────┐            │  │
│  │  │  BUSINESS LOGIC (inline in route handler)     │            │  │
│  │  │  • Prisma queries (direct, no repository)     │            │  │
│  │  │  • $transaction for multi-model mutations     │            │  │
│  │  │  • Fee calculations, status derivation        │            │  │
│  │  │  • File upload orchestration                  │            │  │
│  │  │  • Sequential ID generation                   │            │  │
│  │  └──────────────────────────────────────────────┘            │  │
│  │         │                                                     │  │
│  │         ▼                                                     │  │
│  │  logAction() ──► apiSuccess() / apiError()                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                       DATA & SERVICES LAYER                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Prisma ORM   │  │ Firebase     │  │ Sharp (Image Processing) │ │
│  │ + $extends   │  │ Admin SDK    │  │ + Local / Proxy Upload   │ │
│  │ (soft delete) │  │ (token verify)│  └──────────────────────────┘ │
│  └──────┬───────┘  └──────────────┘                                │
│         │                                                           │
│  ┌──────▼───────┐                                                  │
│  │   MySQL DB   │                                                  │
│  │  (~40 models)│                                                  │
│  │  Multi-tenant│                                                  │
│  └──────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT                                  │
│                                                                     │
│  Vercel (Edge Middleware + Serverless Functions + Static Assets)    │
│  MySQL (external, via DATABASE_URL)                                │
│  Firebase (external, auth provider)                                │
└─────────────────────────────────────────────────────────────────────┘
```

&nbsp;

---

&nbsp;

## 2. Technology Stack Identification

&nbsp;

### Frontend Framework

&nbsp;

- **Next.js 15** (App Router) with **React 19** — all dashboard pages are client-side rendered (`"use client"`)

- The dashboard layout (`src/app/(dashboard)/layout.tsx:6-33`) is the only server component; it calls `auth()` and passes session to providers

- No server components are used for data fetching; every page fetches client-side via `fetch()`

&nbsp;

### Backend Framework

&nbsp;

- **Next.js API Routes** under `src/app/api/v1/` — 51 route files implementing REST endpoints

- No separate backend; the API layer is embedded within the same Next.js application

&nbsp;

### Database Architecture

&nbsp;

- **MySQL** via **Prisma ORM v6.19** (`prisma/schema.prisma` — ~1,214 lines, ~40 models)

- Singleton Prisma client with soft-delete extensions for 4 models (`src/lib/prisma.ts`)

- All queries scoped by `organizationId` for tenant isolation

- `Prisma.Decimal` for monetary calculations

- Atomic sequential ID generation via `SystemSequence` table (`src/lib/unique-id.ts`)

&nbsp;

### Authentication Architecture

&nbsp;

- **Dual-system**: Firebase client SDK for credential auth → NextAuth.js v5 for session management

- Split config: `src/lib/auth.config.ts` (edge-safe for middleware) and `src/lib/auth.ts` (Node.js with Credentials provider)

- JWT sessions with 24-hour max age containing tenant context

- Firebase Admin SDK for server-side token verification (`src/lib/firebase-admin.ts`)

&nbsp;

### API Architecture

&nbsp;

- REST with standardized response envelope (`src/lib/api-helpers.ts`)

- Permission-gated via `checkApiPermission()` at the top of every handler

- Tenant context extracted via `getTenantContext()` from middleware-injected headers

- Zod validation for request bodies (`src/lib/validations/`)

- Optional idempotency for mutations via `withIdempotency()` (`src/lib/idempotency.ts`)

&nbsp;

### Third-Party Integrations

&nbsp;

- **Firebase Authentication** (client + admin SDKs)

- **AG Grid Community** (data tables)

- **Radix UI** (11 primitive components)

- **Sharp** (server-side image processing)

&nbsp;

### File Storage Architecture

&nbsp;

- Dual-mode: local disk (`public/uploads/`) or remote proxy to cPanel via HTTP (`src/lib/upload.ts`)

- Magic byte validation, Sharp resize/compress to WebP

- Max 2MB, organized by subdirectory (student-photos, student-documents, staff-documents)

&nbsp;

### Deployment Architecture

&nbsp;

- **Vercel** — Edge Middleware + Serverless Functions

- External MySQL database (via `DATABASE_URL`)

- External Firebase project (auth only, no Firestore/Storage)

- `firebase-admin` and `sharp` marked as `serverExternalPackages` in `next.config.ts`

&nbsp;

---

&nbsp;

## 3. Architecture Review

&nbsp;

### Folder Structure

&nbsp;

The project follows a **feature-by-route** organization inside Next.js App Router conventions:

&nbsp;

```
src/
├── app/           Route-based pages and API handlers
├── components/    UI (generic) + feature-specific form components
├── hooks/         Custom React hooks (9 files)
├── lib/           Core utilities, auth, DB, validation
├── config/        Permission definitions + navigation config
├── types/         NextAuth type augmentation (1 file)
```

&nbsp;

**Assessment**: The structure is appropriate for the project's current size. The `components/` directory correctly separates `ui/` (generic) from feature folders (`student/`, `fees/`, `admissions/`). However, the `lib/` directory has grown into a catch-all — it contains auth, database, validation, upload logic, audit logging, idempotency, and utilities all flattened together.

&nbsp;

### Separation of Concerns

&nbsp;

This is the most significant architectural issue. **Business logic is embedded directly in API route handlers** with no service or domain layer.

&nbsp;

**Evidence** — `src/app/api/v1/students/route.ts:174-444` (POST handler, 270 lines):

&nbsp;

- Validates input via Zod (lines 195-198)

- Verifies branch ownership (lines 209-214)

- Verifies section/class references (lines 218-240)

- Generates admission number (line 242)

- Processes photo upload (lines 246-257)

- Processes ID document upload (lines 260-272)

- Opens a Prisma transaction that creates: student record, enrollment, fee structures lookup, invoice with line items, and fee payment (lines 275-424)

- Performs audit logging (lines 426-434)

&nbsp;

This single function handles input validation, authorization enforcement, reference integrity checks, file I/O, financial calculations, multi-model database writes, and audit logging. There is no `StudentService`, `FeeService`, or domain model separating these concerns.

&nbsp;

Similarly, `src/app/api/v1/fees/route.ts:9-155` computes fee statuses (PAID/PARTIAL/OVERDUE/PENDING), earliest due dates, and aggregates invoice totals inline within the GET handler.

&nbsp;

### Domain Boundaries

&nbsp;

The codebase has **implicit** domain boundaries that map to route folders, but no explicit domain layer enforces them:

&nbsp;

| Domain      | API Routes                         | Components                                   | Validation                 |
|:------------|:-----------------------------------|:---------------------------------------------|:---------------------------|
| Students    | `api/v1/students/`                 | `components/student/`                        | `validations/student.ts`   |
| Staff       | `api/v1/staff/`                    | `components/staff/`                          | `validations/staff.ts`     |
| Fees        | `api/v1/fees/`                     | `components/fees/`                           | `validations/fee-payment.ts` |
| Admissions  | `api/v1/admissions/`               | `components/admissions/`                     | `validations/admission.ts` |
| Users/Roles | `api/v1/users/`, `api/v1/roles/`   | `components/users/`, `components/roles/`     | `validations/user.ts`      |

&nbsp;

**Cross-domain coupling is present**: the student creation route (`students/route.ts`) directly queries `feeStructure`, creates `invoice` records, and creates `feePayment` records. The student domain is tightly coupled to the fees domain at the route handler level.

&nbsp;

### Scalability of Architecture

&nbsp;

**Current strengths:**

&nbsp;

- Multi-tenancy via `organizationId` scoping is consistently applied

- Prisma's connection pooling handles moderate concurrency

- Edge middleware is lightweight and stateless

- Vercel's serverless model auto-scales API handlers

&nbsp;

**Scalability risks:**

&nbsp;

1. **No caching layer** — Every API call hits MySQL directly. There's no Redis, no in-memory cache, no HTTP cache headers. The `checkApiPermission()` function (`src/lib/rbac.ts`) makes 2-3 DB queries per API request (user active check + permission resolution).

2. **Client fetches everything** — Pages like students list request `limit=9999` to load all records for client-side filtering. This will break at scale.

3. **N+1 potential** — The fees GET handler (`src/app/api/v1/fees/route.ts:87-148`) iterates student invoices in JavaScript rather than doing aggregation in SQL.

4. **No background job system** — `src/lib/tasks/late-fees-cron.ts` exists but there's no job queue or scheduler infrastructure.

5. **Single database** — No read replicas, no connection pooling configuration visible beyond Prisma defaults.

&nbsp;

### Coupling Between Modules

&nbsp;

**Tight coupling observed in:**

&nbsp;

- Student creation → Fee structures, Invoices, Fee payments (`src/app/api/v1/students/route.ts:332-419`)

- Fees listing → Student enrollments, Section/Class hierarchy (`src/app/api/v1/fees/route.ts:46-85`)

- All pages → `usePermissions()` hook → `/api/v1/me/permissions` endpoint → DB queries

&nbsp;

**Loose coupling observed in:**

&nbsp;

- Auth system is well-isolated (`auth.ts`, `auth.config.ts`, `firebase.ts`, `firebase-admin.ts`)

- Audit logging is fire-and-forget with no return dependency (`src/lib/audit.ts`)

- Upload system is self-contained (`src/lib/upload.ts`)

- Validation schemas are standalone files with no cross-imports between domains

&nbsp;

### Design Patterns Used

&nbsp;

| Pattern                 | Implementation                                     | Location                                                                     |
|:------------------------|:---------------------------------------------------|:-----------------------------------------------------------------------------|
| Singleton               | Prisma client instance                             | `src/lib/prisma.ts:190-198`                                                  |
| Middleware/Chain         | Edge middleware for auth + tenant injection         | `src/middleware.ts`                                                          |
| Extension/Decorator     | Prisma `$extends` for soft deletes                 | `src/lib/prisma.ts:8-187`                                                   |
| Provider/Context        | Permissions + Snackbar contexts                    | `src/hooks/use-permissions.tsx`, `src/components/ui/snackbar.tsx`            |
| Envelope/DTO            | Standardized API response format                   | `src/lib/api-helpers.ts`                                                    |
| Gate/Guard              | `<PermissionGate>` component, `checkApiPermission()` | `src/components/shared/permission-gate.tsx`, `src/lib/rbac.ts`            |
| Idempotency Key         | Request deduplication with DB locking              | `src/lib/idempotency.ts`                                                    |
| Stale-While-Revalidate  | Permission caching in sessionStorage               | `src/hooks/use-permissions.tsx`                                             |

&nbsp;

**Notable absences**: Repository pattern, Service layer, Domain events, CQRS, Unit of Work (beyond Prisma transactions).

&nbsp;

### Missing Abstractions

&nbsp;

1. **Service Layer** — No `StudentService`, `FeeService`, `AdmissionService` classes. Business logic that spans multiple models (student + enrollment + invoice + payment) lives in route handlers. This makes logic untestable in isolation and non-reusable across endpoints.

&nbsp;

2. **Repository Abstraction** — Prisma is called directly in every route handler. Common query patterns (tenant-scoped findMany with pagination, search, and branch filtering) are duplicated across routes rather than abstracted.

&nbsp;

3. **API Client / Data Fetching Layer** — Frontend pages call `fetch()` directly with manual loading/error state. No shared `apiClient` wrapper, no request/response interceptors, no automatic token refresh handling.

&nbsp;

4. **Error Hierarchy** — The backend uses ad-hoc error strings (`"AMOUNT_EXCEEDS_TOTAL"`) thrown as `new Error()` and caught by message comparison (`src/app/api/v1/students/route.ts:366,438`). There's no typed error hierarchy or domain exception classes.

&nbsp;

5. **DTO/Mapper Layer** — Data transformation (e.g., computing `pendingFees`, `totalFeesPaid`, deriving `status`) happens inline in route handlers. No dedicated mapper or transformer functions.

&nbsp;

6. **Form Abstraction** — Despite React Hook Form being installed (`package.json`), forms use individual `useState` per field. Complex forms like `StudentForm` have 30+ individual state variables.

&nbsp;

### Technical Debt in Architecture

&nbsp;

1. **Route handler bloat** — `POST /api/v1/students` is 270 lines handling 6+ concerns. As features grow (transport assignment, hostel allocation, library card), this handler will continue expanding.

&nbsp;

2. **Inconsistent soft-delete coverage** — Only 4 models have soft-delete extensions (`src/lib/prisma.ts`). Other entities (classes, sections, academic years, books, etc.) use hard deletes, creating inconsistency in data retention policy.

&nbsp;

3. **`limit=9999` pattern** — Multiple frontend pages request effectively all records to enable client-side filtering via AG Grid's `quickFilter`. This bypasses server-side pagination entirely.

&nbsp;

4. **No structured logging** — All error handling uses `console.error()` (`src/app/api/v1/students/route.ts:166`, `src/app/api/v1/fees/route.ts:152`). No structured logger (Pino, Winston) for production observability.

&nbsp;

5. **Duplicate branch-scoping logic** — The 8-line pattern for branch filtering (`if ctx.branchId && branchId !== "__all__"`) is copy-pasted across nearly every API route handler rather than being extracted into a shared utility.

&nbsp;

6. **Auth split complexity** — The two-file auth split (`auth.ts` for Node.js, `auth.config.ts` for Edge) is a NextAuth v5 beta requirement. When NextAuth stabilizes, this should be re-evaluated.

&nbsp;

7. **No TypeScript enums for domain constants** — Statuses like `"DROPPED"`, `"TERMINATED"`, `"PENDING"`, `"PARTIAL"`, `"OVERDUE"`, `"PAID"` are string literals throughout. No central enum or const object ensures consistency.

&nbsp;

---

&nbsp;

## 4. Findings

&nbsp;

### Architecture Strengths

&nbsp;

1. **Robust multi-tenancy** — Tenant isolation is enforced at three levels: Edge middleware strips spoofed headers, injects trusted context, and every Prisma query is scoped by `organizationId`. This is a sound design for a SaaS ERP.

&nbsp;

2. **Well-designed RBAC** — The three-tier resolution (user override → role default → deny) with SUPER_ADMIN bypass is a mature pattern. Permission caching on the client via Stale-While-Revalidate in sessionStorage is a good optimization. The server-side `checkApiPermission()` validates both permission and user/org active status on every call, enabling instant revocation.

&nbsp;

3. **Consistent API contract** — Every endpoint returns `{ success, data/error, meta }` via standardized helpers. This makes the API predictable for consumers and simplifies frontend error handling.

&nbsp;

4. **Prisma soft-delete extensions** — The `$extends` approach for transparent soft deletes is elegant. Callers use normal `findMany`/`delete` and the extension handles the `deletedAt` filtering and status updates automatically.

&nbsp;

5. **Idempotency infrastructure** — The DB-locked idempotency key system with polling and automatic cleanup on failure is production-grade. The companion `useSafeSubmit()` hook provides a clean client integration.

&nbsp;

6. **Security-conscious middleware** — Stripping all `x-*` headers from inbound requests before injecting server-trusted values (`src/middleware.ts:34-38`) is a critical safeguard that many projects miss.

&nbsp;

7. **Zod validation co-location** — Having validation schemas in `src/lib/validations/` that are usable on both client and server prevents schema drift and reduces duplication.

&nbsp;

8. **Clean layout hierarchy** — The dashboard layout (`src/app/(dashboard)/layout.tsx`) is a minimal server component that obtains the session and delegates to providers. The shell/nav-rail/drawer pattern scales well across screen sizes.

&nbsp;

### Architecture Weaknesses

&nbsp;

1. **No service layer — business logic trapped in route handlers.** This is the most impactful weakness. The student creation handler (`src/app/api/v1/students/route.ts:174-444`) contains enrollment logic, fee calculation, invoice generation, payment processing, file upload orchestration, and audit logging in a single function. This is untestable, non-reusable, and will become unmanageable as the system grows.

&nbsp;

2. **No data fetching abstraction on the frontend.** Every page re-implements the same fetch-parse-setState-catch pattern. There's no shared `apiClient`, no request interceptor for auth token refresh, no automatic retry, and no cache invalidation strategy. SWR or React Query would eliminate significant boilerplate and provide caching.

&nbsp;

3. **Cross-domain coupling in route handlers.** Student creation directly manipulates fee structures, invoices, and payments. If fee logic changes (new discount types, installment plans), the student creation endpoint must change too. These should be separate services with the student handler calling a `FeeService.createInitialInvoice()`.

&nbsp;

4. **Missing repository/query builder abstraction.** The branch-scoping logic, pagination, and search pattern is duplicated in every GET handler. A `TenantScopedQuery` builder or repository base class would eliminate this repetition.

&nbsp;

5. **Client-side-only rendering model does not leverage Next.js 15.** Every dashboard page is `"use client"`. The App Router's server component data fetching, streaming, and Suspense boundaries are entirely unused. The project is effectively a CSR SPA served by Next.js.

&nbsp;

6. **No caching at any layer.** No Redis, no HTTP cache headers, no ISR, no request memoization. Every navigation, every filter change, every page load hits the database with no intermediary cache.

&nbsp;

### Scalability Risks

&nbsp;

| Risk                                             | Impact                                       | Root Cause                                                         |
|:-------------------------------------------------|:---------------------------------------------|:-------------------------------------------------------------------|
| Permission checks hit DB on every API call       | High latency at scale                        | No permission caching on server (only client sessionStorage)       |
| `limit=9999` fetches on list pages               | Memory/bandwidth blowout with large datasets | No server-side search; relies on AG Grid client-side filtering     |
| No read replicas or connection pooling config    | DB becomes bottleneck                        | Single MySQL instance, default Prisma pool settings                |
| Inline fee computations in JavaScript            | CPU-bound route handlers                     | Aggregation not pushed to SQL; done in Node.js per-row loops       |
| No background job infrastructure                 | Cron tasks can't scale                       | `late-fees-cron.ts` exists but no scheduler or queue               |
| Monolithic deployment                            | All domains scale together                   | No module federation or microservice boundary                      |

&nbsp;

### Refactoring Recommendations

&nbsp;

#### Priority 1 — Extract a Service Layer

&nbsp;

Create domain services under `src/services/` that encapsulate multi-model business logic:

&nbsp;

- `StudentService.create()` — handles student + enrollment + initial fee setup

- `FeeService.createInvoice()`, `FeeService.recordPayment()`, `FeeService.computeStudentFeeStatus()`

- `AdmissionService.promoteToStudent()`

&nbsp;

Route handlers would become thin controllers: validate → delegate to service → respond.

&nbsp;

#### Priority 2 — Introduce a Data Fetching Layer

&nbsp;

Adopt SWR or TanStack Query on the frontend. Create an `apiClient` wrapper in `src/lib/api-client.ts` with:

&nbsp;

- Base URL configuration

- Automatic `Content-Type` and auth headers

- Response envelope unwrapping

- Error normalization

&nbsp;

Replace raw `fetch()` + `useState` patterns across all pages.

&nbsp;

#### Priority 3 — Extract Common Query Patterns

&nbsp;

Create a `src/lib/query-helpers.ts` with:

&nbsp;

- `buildTenantWhere(ctx, branchId)` — consolidate the 8-line branch-scoping pattern

- `buildSearchWhere(search, fields[])` — consolidate OR-search construction

- `paginatedQuery(model, where, select, pagination)` — consolidate findMany + count + response

&nbsp;

#### Priority 4 — Implement Server-Side Pagination

&nbsp;

Remove `limit=9999` patterns. Use AG Grid's server-side row model or implement server-side search/filter/sort and pass proper pagination to the API.

&nbsp;

#### Priority 5 — Add Domain Constants

&nbsp;

Create `src/config/constants.ts` with typed enums or `as const` objects for:

&nbsp;

- Student statuses (ACTIVE, DROPPED, SUSPENDED, ALUMNI)

- Fee statuses (PENDING, PARTIAL, PAID, OVERDUE, CANCELLED)

- Payment methods (CASH, ONLINE, CHEQUE, BANK_TRANSFER, UPI)

- Staff statuses (ACTIVE, TERMINATED, RESIGNED)

&nbsp;

---

&nbsp;

## 5. Architecture Score

&nbsp;

| Dimension              | Score  | Notes                                                                        |
|:-----------------------|:-------|:-----------------------------------------------------------------------------|
| Folder structure       | 7/10   | Clean route-based organization; `lib/` is a flat catch-all                   |
| Separation of concerns | 4/10   | No service layer; route handlers are fat controllers                         |
| Domain boundaries      | 5/10   | Implicit boundaries exist but are violated (student to fees coupling)        |
| Scalability            | 4/10   | No caching, `limit=9999`, per-request DB permission checks                   |
| Coupling               | 5/10   | Auth and upload are well-isolated; domain modules are tightly coupled        |
| Design patterns        | 7/10   | Good use of middleware, extensions, RBAC, idempotency                        |
| Abstractions           | 4/10   | Missing service, repository, API client, error hierarchy layers              |
| Technical debt         | 5/10   | Copy-paste query patterns, string literals, no structured logging            |
| Security architecture  | 8/10   | Header spoofing prevention, RBAC, instant revocation, magic byte validation  |
| Auth architecture      | 8/10   | Firebase + NextAuth split is well-implemented with proper token lifecycle    |

&nbsp;

### Overall Architecture Score: 5.7 / 10

&nbsp;

The system has a solid foundation — multi-tenancy, RBAC, auth, and API contracts are well-designed and production-ready. The principal weakness is the absence of a service layer, which has caused business logic to accumulate in route handlers and cross-domain coupling to go unchecked. This, combined with no caching strategy, no data fetching abstraction, and client-side pagination workarounds, means the architecture will resist growth. The bones are good; the muscles need restructuring.
