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

Every data query is scoped by `organizationId`. The middleware (`src/middleware.ts`) extracts the session and injects tenant context as request headers. API routes read these via `getTenantContext()` from `src/lib/rbac.ts`.

Headers injected by middleware: `x-user-id`, `x-user-role-id`, `x-user-role-name`, `x-organization-id`, `x-branch-id` (nullable).

### Authentication Flow

1. Client authenticates with Firebase (`signInWithEmailAndPassword`)
2. Firebase ID token is sent to NextAuth.js via `signIn("firebase", { idToken })`
3. Server verifies token with Firebase Admin SDK, looks up user in DB
4. JWT session cookie is set containing `userId`, `role`, `organizationId`, `branchId`, etc.

Key files: `src/lib/auth.ts` (NextAuth config), `src/lib/auth.config.ts` (edge-safe JWT callbacks), `src/lib/firebase.ts` (client SDK), `src/lib/firebase-admin.ts` (admin SDK).

### RBAC (Role-Based Access Control)

10 roles: SUPER_ADMIN, SCHOOL_ADMIN, BRANCH_ADMIN, TEACHER, STUDENT, PARENT, ACCOUNTANT, LIBRARIAN, RECEPTIONIST, TRANSPORT_MANAGER. SUPER_ADMIN bypasses all permission checks.

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

Helpers in `src/lib/api-helpers.ts`: `apiSuccess()`, `apiError()`, `apiValidationError()`, `apiNotFound()`, `apiUnauthorized()`, `apiForbidden()`, `parsePagination()`.

Pagination: `?page=1&limit=20&search=term` (max limit 100).

Typical API route pattern:
1. `checkApiPermission(req, module, action)` — returns 403 or null
2. `getTenantContext(req)` — extract org/branch/user from headers
3. Parse pagination / validate body with Zod
4. Prisma query scoped by `organizationId`
5. Return via `apiSuccess()` / `apiError()`

### Validation

Zod schemas in `src/lib/validations/` are used for both API route validation (server) and React Hook Form resolver (client). Each entity has its own schema file.

### File Uploads

`src/lib/upload.ts` supports two modes: local disk storage to `public/uploads/` or remote proxy via `UPLOAD_PROXY_URL` (cPanel endpoint). Images processed with Sharp. Organized by type subdirectories (student-photos, student-documents, staff-documents). Max 2MB, JPEG/PNG/WebP only.

### Route Groups

- `src/app/(auth)/` — Login, register, forgot-password (public)
- `src/app/(dashboard)/` — All protected pages (students, staff, classes, etc.)
- `src/app/(marketing)/` — Public-facing pages
- `src/app/api/v1/` — REST API endpoints

### UI Components

~24 custom components in `src/components/ui/` built on Radix UI primitives with Tailwind CSS 4 following Material Design 3 patterns (teal theme). Key components: `data-table.tsx` (AG Grid wrapper), `text-field.tsx`, `select.tsx`, `dialog.tsx`, `snackbar.tsx`, `chip.tsx` (glassmorphism). Layout components (dashboard-shell, nav-rail, top-app-bar, branch-switcher) in `src/components/layout/`.

### Hooks

Custom hooks in `src/hooks/`: `use-permissions` (RBAC checks), `use-current-user`, `use-branches`, `use-roles`, `use-all-permissions`, `use-subject-masters`, `use-teachers`, `use-media-query`.

### Session Shape

JWT session (24h max age) contains: `id`, `email`, `name`, `image`, `roleId`, `roleName`, `organizationId`, `organizationSlug`, `organizationName`, `branchId`, `branchName`. Auth config split: `src/lib/auth.config.ts` (edge-safe, used by middleware) and `src/lib/auth.ts` (full config with Credentials provider, Node.js only).

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Database

Prisma schema at `prisma/schema.prisma` with MySQL. ~40 models covering: Organization/Branch tenancy, User/Permission RBAC, AcademicYear/Class/Section/Subject academics, Student/Parent/Enrollment, Staff/Documents, Attendance, Timetable, Exam/Marks, Fees/Invoices/Payments, Transport, Library, Hostel, Notices/Events.

After changing the schema, run `npm run db:generate` to regenerate the Prisma client, then `npm run db:push` or `npm run db:migrate` to sync the database.

## Deployment

Hosted on Vercel. `next.config.ts` marks `firebase-admin` and `sharp` as `serverExternalPackages`. Remote images allowed from `lh3.googleusercontent.com` and `firebasestorage.googleapis.com`. Git excludes `prisma/migrations/`, `public/uploads/`, and `package-lock.json`.

## Environment Variables

Required in `.env`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, six `NEXT_PUBLIC_FIREBASE_*` keys for client SDK, three `FIREBASE_*` keys for admin SDK (project ID, client email, private key). Optional: `UPLOAD_PROXY_URL`, `UPLOAD_PROXY_SECRET`, `NEXT_PUBLIC_UPLOAD_BASE_URL` for remote file uploads.
