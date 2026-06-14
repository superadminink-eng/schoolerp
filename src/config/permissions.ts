// Config for default system roles

/**
 * All modules and their available actions.
 */
export const MODULES = {
  students: ["create", "read", "update", "delete"],
  staff: ["create", "read", "update", "delete"],
  attendance: ["create", "read", "update"],
  fees: ["create", "read", "update", "approve"],
  exams: ["create", "read", "update", "grade"],
  timetable: ["read", "manage"],
  transport: ["read", "manage"],
  library: ["read", "manage"],
  hostel: ["read", "manage"],
  notices: ["create", "read", "update", "delete"],
  events: ["create", "read", "update", "delete"],
  reports: ["view", "export"],
  settings: ["manage"],
  subjects: ["create", "read", "update", "delete"],
  classes: ["create", "read", "update", "delete"],
  academic_years: ["create", "read", "update", "delete"],
  branches: ["read", "manage"],
  users: ["create", "read", "update", "delete"],
  admissions: ["inquiry_desk", "document_verification", "entrance_exam", "registrar_desk", "delete"],
} as const;

/**
 * Default permissions per role.
 * SUPER_ADMIN gets everything automatically (handled in rbac.ts).
 */
export const DEFAULT_ROLE_PERMISSIONS: Partial<
  Record<string, string[]>
> = {
  SUPER_ADMIN: [], // Has bypass in rbac.ts
  SCHOOL_ADMIN: [
    "students:create", "students:read", "students:update", "students:delete",
    "staff:create", "staff:read", "staff:update", "staff:delete",
    "attendance:create", "attendance:read", "attendance:update",
    "fees:create", "fees:read", "fees:update", "fees:approve",
    "exams:create", "exams:read", "exams:update", "exams:grade",
    "timetable:read", "timetable:manage",
    "transport:read", "transport:manage",
    "library:read", "library:manage",
    "hostel:read", "hostel:manage",
    "notices:create", "notices:read", "notices:update", "notices:delete",
    "events:create", "events:read", "events:update", "events:delete",
    "reports:view", "reports:export",
    "settings:manage",
    "subjects:create", "subjects:read", "subjects:update", "subjects:delete",
    "classes:create", "classes:read", "classes:update", "classes:delete",
    "academic_years:create", "academic_years:read", "academic_years:update", "academic_years:delete",
    "branches:read", "branches:manage",
    "users:create", "users:read", "users:update", "users:delete",
    "admissions:inquiry_desk", "admissions:document_verification", "admissions:entrance_exam", "admissions:registrar_desk", "admissions:delete",
  ],
  BRANCH_ADMIN: [
    "students:create", "students:read", "students:update",
    "staff:create", "staff:read", "staff:update",
    "fees:create", "fees:read", "fees:update", "fees:approve",
    "notices:create", "notices:read", "notices:update",
    "reports:view", "reports:export",
    "subjects:create", "subjects:read", "subjects:update", "subjects:delete",
    "classes:create", "classes:read", "classes:update", "classes:delete",
    "academic_years:create", "academic_years:read", "academic_years:update", "academic_years:delete",
    "branches:read",
    "admissions:inquiry_desk", "admissions:document_verification", "admissions:entrance_exam", "admissions:registrar_desk",
  ],
  TEACHER: [
    "students:read",
    "staff:read",
    "attendance:create", "attendance:read",
    "exams:read", "exams:grade",
    "timetable:read",
    "library:read",
    "notices:read",
    "events:read",
    "reports:view",
    "subjects:read",
    "classes:read",
  ],
  STUDENT: [
    "attendance:read",
    "fees:read",
    "exams:read",
    "timetable:read",
    "library:read",
    "notices:read",
    "events:read",
  ],
  PARENT: [
    "students:read",
    "attendance:read",
    "fees:read",
    "exams:read",
    "timetable:read",
    "notices:read",
    "events:read",
  ],
  ACCOUNTANT: [
    "students:read",
    "fees:create", "fees:read", "fees:update", "fees:approve",
    "reports:view", "reports:export",
    "classes:read",
  ],
  LIBRARIAN: [
    "students:read",
    "library:read", "library:manage",
  ],
  RECEPTIONIST: [
    "students:read",
    "staff:read",
    "notices:read",
    "events:read",
    "admissions:inquiry_desk",
    "classes:read",
    "academic_years:read",
  ],
  COUNSELOR: [
    "students:read",
    "staff:read",
    "notices:read",
    "events:read",
    "admissions:inquiry_desk",
    "classes:read",
    "academic_years:read",
  ],
  TRANSPORT_MANAGER: [
    "students:read",
    "transport:read", "transport:manage",
  ],
};

/**
 * Sidebar navigation items per role.
 */
export const NAVIGATION_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", roles: "all" as const },
  { label: "Branches", href: "/branches", icon: "location_city", permission: "branches:manage" },
  { label: "Users", href: "/users", icon: "group", permission: "users:read" },
  { label: "Roles", href: "/roles", icon: "security", permission: "settings:manage" },
  { label: "Staff", href: "/staff", icon: "badge", permission: "staff:read" },
  { label: "Academic Years", href: "/academic-years", icon: "date_range", permission: "academic_years:read" },
  { label: "Subjects", href: "/subject-masters", icon: "menu_book", permission: "subjects:read" },
  { label: "Classes", href: "/classes", icon: "class", permission: "classes:read" },
  { label: "Students", href: "/students", icon: "school", permission: "students:read" },
  { label: "Fees", href: "/fees", icon: "payments", permission: "fees:read" },
  { label: "Admissions", href: "/admissions", icon: "app_registration", permission: "admissions:inquiry_desk,admissions:document_verification,admissions:entrance_exam,admissions:registrar_desk" },
  // { label: "Attendance", href: "/attendance/students", icon: "fact_check", permission: "attendance:read" },
  // { label: "Exams", href: "/exams", icon: "quiz", permission: "exams:read" },
  // { label: "Timetable", href: "/timetable", icon: "calendar_month", permission: "timetable:read" },
  // { label: "Transport", href: "/transport/routes", icon: "directions_bus", permission: "transport:read" },
  // { label: "Library", href: "/library/books", icon: "local_library", permission: "library:read" },
  // { label: "Hostel", href: "/hostel", icon: "apartment", permission: "hostel:read" },
  { label: "Notices", href: "/notices", icon: "campaign", permission: "notices:read" },
  // { label: "Events", href: "/communication/events", icon: "event", permission: "events:read" },
  // { label: "Reports", href: "/reports", icon: "analytics", permission: "reports:view" },
  
  // { label: "Settings", href: "/settings/general", icon: "settings", permission: "settings:manage" },
];
