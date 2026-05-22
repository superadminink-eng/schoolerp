# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant School ERP system built with Next.js 15 (App Router), TypeScript, Prisma ORM (MySQL), Firebase Authentication, and NextAuth.js v5. The app manages students, staff, classes, fees, attendance, exams, transport, library, and hostel operations across organizations and branches.

## Commands

```bash
npm run dev              # Dev server with Turbopack on port 3007
npm run build            # Production build
npm run lint             # ESLint
npm run db:generate      # Generate Prisma client after schema changes
npm run db:push          # Push schema to DB without migrations
npm run db:migrate       # Run Prisma migrations (dev)
npm run db:seed          # Seed database (tsx prisma/seed.ts)
npm run db:studio        # Open Prisma Studio GUI
```

No test framework is configured.

## Architecture

### Multi-Tenancy

Every data query is scoped by `organizationId`. The middleware (`src/middleware.ts`) extracts the session and injects tenant context as request headers (`x-user-id`, `x-user-role`, `x-organization-id`, `x-branch-id`). API routes read these via `getTenantContext()` from `src/lib/rbac.ts`.

### Authentication Flow

1. Client authenticates with Firebase (`signInWithEmailAndPassword`)
2. Firebase ID token is sent to NextAuth.js via `signIn("firebase", { idToken })`
3. Server verifies token with Firebase Admin SDK, looks up user in DB
4. JWT session cookie is set containing `userId`, `role`, `organizationId`, `branchId`, etc.

Key files: `src/lib/auth.ts` (NextAuth config), `src/lib/auth.config.ts` (edge-safe JWT callbacks), `src/lib/firebase.ts` (client SDK), `src/lib/firebase-admin.ts` (admin SDK).

### RBAC (Role-Based Access Control)

9 roles: SUPER_ADMIN, SCHOOL_ADMIN, BRANCH_ADMIN, TEACHER, STUDENT, PARENT, ACCOUNTANT, LIBRARIAN, RECEPTIONIST, TRANSPORT_MANAGER. SUPER_ADMIN bypasses all permission checks.

Permission resolution: user-level override → role default → deny. Permissions are `module:action` strings (e.g., `students:create`).

- **Server**: `checkApiPermission(req, module, action)` in `src/lib/rbac.ts` — returns 403 Response or null
- **Client**: `usePermissions()` hook and `<PermissionGate>` component in `src/components/shared/`
- **Definitions**: `src/config/permissions.ts`

### API Structure

All REST endpoints under `src/app/api/v1/`. Standard response format:

```typescript
// Success: { success: true, data: T, meta?: { page, limit, total } }
// Error:   { success: false, error: { code, message, details? } }
```

Helpers in `src/lib/api-helpers.ts`: `apiSuccess()`, `apiError()`, `apiValidationError()`, `apiNotFound()`, `parsePagination()`.

Pagination: `?page=1&limit=20&search=term` (max limit 100).

### Validation

Zod schemas in `src/lib/validations/` are used for both API route validation (server) and React Hook Form resolver (client). Each entity has its own schema file.

### File Uploads

Local disk storage to `public/uploads/` via `src/lib/upload.ts`. Organized by type subdirectories (student-photos, student-documents, staff-documents). Max 2MB, JPEG/PNG/WebP only.

### Route Groups

- `src/app/(auth)/` — Login, register, forgot-password (public)
- `src/app/(dashboard)/` — All protected pages (students, staff, classes, etc.)
- `src/app/(marketing)/` — Public-facing pages
- `src/app/api/v1/` — REST API endpoints

### UI Components

Custom component library in `src/components/ui/` built on Radix UI primitives with Tailwind CSS following Material Design 3 patterns. Layout components (shell, nav-rail, top-app-bar, branch-switcher) in `src/components/layout/`.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Database

Prisma schema at `prisma/schema.prisma` with MySQL. ~40 models covering: Organization/Branch tenancy, User/Permission RBAC, AcademicYear/Class/Section/Subject academics, Student/Parent/Enrollment, Staff/Documents, Attendance, Timetable, Exam/Marks, Fees/Invoices/Payments, Transport, Library, Hostel, Notices/Events.

After changing the schema, run `npm run db:generate` to regenerate the Prisma client, then `npm run db:push` or `npm run db:migrate` to sync the database.

## Environment Variables

Required in `.env`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, six `NEXT_PUBLIC_FIREBASE_*` keys for client SDK, and three `FIREBASE_*` keys for admin SDK (project ID, client email, private key).
