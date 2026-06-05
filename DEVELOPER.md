# Developer & Architecture Guide (School ERP)

This guide serves as a persistent, high-context reference for development agents and developers. It summarizes the entire application architecture, database state, design patterns, and authentication systems so that you don't need to read the entire codebase from scratch.

---

## 📂 Core Directory Map

```
d:\schoolapp\school-erp\
├── prisma/
│   ├── schema.prisma         # Database models (MySQL)
│   └── seed.ts               # Default Roles & Permissions seed logic
├── src/
│   ├── app/
│   │   ├── (auth)/           # Public pages: login, register, forgot-password
│   │   ├── (dashboard)/      # Protected ERP pages (students, staff, fees, etc.)
│   │   ├── api/v1/           # Scoped REST API Endpoints
│   │   ├── globals.css       # Design tokens & Deep Teal overrides
│   │   └── layout.tsx        # Base HTML layout
│   ├── components/
│   │   ├── layout/           # Sidebar, Nav Rail, User Menu, Top App Bar
│   │   ├── ui/               # Core atomic design components (data-table, chip, etc.)
│   │   └── [module]/         # Feature-specific page components (users, roles, etc.)
│   ├── config/
│   │   └── permissions.ts    # RBAC Modules & Default Permission arrays
│   ├── hooks/                # Custom React hooks (usePermissions, useCurrentUser, etc.)
│   ├── lib/
│   │   ├── auth.ts           # Full NextAuth server config (Firebase Admin SDK)
│   │   ├── auth.config.ts    # Edge-safe NextAuth middleware callbacks
│   │   ├── firebase.ts       # Client-side Firebase SDK configuration
│   │   ├── firebase-admin.ts # Server-side Firebase Admin SDK config
│   │   ├── prisma.ts         # Central Prisma Client instance
│   │   └── rbac.ts           # Tenant context & server API authorization guards
│   └── middleware.ts         # Edge middleware injecting headers
```

---

## 🔑 Authentication & Tenancy Flow

### 1. The Authentication Pipeline
```
[Client App] ──(1. Email/Pass Credentials)──> [Firebase Auth SDK]
                                                    │
                                             (2. Returns ID Token)
                                                    ▼
[Client App] ──(3. NextAuth Sign-In request)──> [NextAuth Server]
                                                    │
                                          (4. Verify with Admin SDK)
                                                    ▼
                                          [Match firebaseUid in DB]
                                                    │
                                           (5. Setup JWT Session)
```

### 2. Multi-Tenancy Scoping
The app is a **multi-tenant** platform. The database structure scopes almost all tables by `organizationId`.
* **Context Injection**: `src/middleware.ts` extracts the user session and injects tenant headers:
  * `x-user-id` (Current user ID)
  * `x-user-role-name` (e.g. `SCHOOL_ADMIN`, `BRANCH_ADMIN`, etc.)
  * `x-organization-id` (Scope for query filtration)
  * `x-branch-id` (Sub-scope for specific branch, nullable)
* **Accessing Context**: API routes in `src/app/api/v1/` use `getTenantContext(req)` from `src/lib/rbac.ts` to retrieve these headers and pass them directly to Prisma queries.

---

## 🗄️ Database & Login State (MySQL)

> [!NOTE]
> All operational transactional tables (Students, Staff, Timetables, Fees, etc.) have been completely cleaned to provide a fresh environment. 
> Only **tenancy, roles, permissions, and active users** are preserved to maintain login stability.

### Active Login Users
These accounts exist in both the local MySQL database and Firebase Authentication project. You can log in using these email addresses:

| Name | Email | Role (`User.role`) | Branch Context |
| :--- | :--- | :--- | :--- |
| **Rohit Kasture** | `kasturer@gmail.com` | `SCHOOL_ADMIN` (Full Organization control) | CSV Vidyalay - Main Branch |
| **Sandip B** | `sandipb@gmail.com` | `BRANCH_ADMIN` (Scoped to Karad branch) | CSV - Karad |
| **Harsha Bhosale** | `hbhosale@gmail.com` | `LIBRARIAN` (Scoped to Karad library) | CSV - Karad |

---

## 🎨 Silicon Valley Style Design System

We employ a unified, declarative design system to prevent visual drift and reduce boilerplate code.

### 1. Declarative Table Columns (`data-table.tsx`)
Instead of page-by-page HTML styling for table cells, `src/components/ui/data-table.tsx` features a **central rendering engine** mapping column data types to styling primitives:
* **`avatar`**: Shows rounded user avatars with automatic first/last name initials and optional subtitles.
* **`badge`**: Renders glassmorphic pill components with dynamic styling and micro-icons.
* **`status-dot`**: Vercel-style status dots (`success` glows with pulse, `error` stays solid red).
* **`currency`**: Automatic local formatting (₹ INR) with color indicators for positive/negative balances.
* **`date`**: Consistent localized formatting across the application.
* **`star-badge`**: Bold highlights with gold stars for identifying parent/main branch records.

### 2. Premium Overrides & Globals
* **Color Accent**: The application is themed around **Deep Teal (`#0F766E`)** for main accents, active menus, and primary actions.
* **Glassmorphism Pill (`chip.tsx`)**: Upgraded to render clean gradients (`bg-gradient-to-r`), backdrop blur (`backdrop-blur-[1px]`), sentence-case micro-typography, and hover micro-scaling animation.
* **No Stretched Chips Constraint**: Fixed a global AG-Grid issue where cells stretched chip components. The wrapper forces flex-center on cell children and forces `line-height: normal !important` via class rules.

---

## 🛠️ Essential Development Commands

* **Run Dev Server**: `npm run dev` (Runs Turbopack on port `3007`).
* **Regenerate Client**: `npm run db:generate` (Always run this after modifying `prisma/schema.prisma`).
* **Push DB Changes**: `npm run db:push` (Syncs database schema directly without migration files).
* **Reset Database Seed**: `npm run db:seed` (Restores all default system roles and permissions mapping).
