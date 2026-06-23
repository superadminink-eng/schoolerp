// Config for default system roles

/**
 * All modules and their available actions.
 */
export const MODULES: Record<string, { standard: ("create"|"read"|"update"|"delete")[], special?: string[] }> = {
  students: { standard: ["create", "read", "update", "delete"] },
  staff: { standard: ["create", "read", "update", "delete"] },
  attendance: { standard: ["create", "read", "update"] },
  fees: { standard: ["create", "read", "update"], special: ["approve"] },
  exams: { standard: ["create", "read", "update"], special: ["grade"] },
  timetable: { standard: ["read"], special: ["manage"] },
  transport: { standard: ["read"], special: ["manage"] },
  library: { standard: ["read"], special: ["manage"] },
  hostel: { standard: ["read"], special: ["manage"] },
  notices: { standard: ["create", "read", "update", "delete"] },
  events: { standard: ["create", "read", "update", "delete"] },
  reports: { standard: ["read"], special: ["export"] },
  settings: { standard: [], special: ["manage"] },
  subjects: { standard: ["create", "read", "update", "delete"] },
  classes: { standard: ["create", "read", "update", "delete"] },
  academic_years: { standard: ["create", "read", "update", "delete"] },
  branches: { standard: ["read"], special: ["manage"] },
  users: { standard: ["create", "read", "update", "delete"] },
  admissions: { standard: ["create", "read", "update", "delete"], special: ["inquiry_desk", "document_verification", "entrance_exam", "registrar_desk"] },
};

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
    "reports:read", "reports:export",
    "settings:manage",
    "subjects:create", "subjects:read", "subjects:update", "subjects:delete",
    "classes:create", "classes:read", "classes:update", "classes:delete",
    "academic_years:create", "academic_years:read", "academic_years:update", "academic_years:delete",
    "branches:read", "branches:manage",
    "users:create", "users:read", "users:update", "users:delete",
    "admissions:create", "admissions:read", "admissions:update", "admissions:delete", "admissions:inquiry_desk", "admissions:document_verification", "admissions:entrance_exam", "admissions:registrar_desk",
  ],
  BRANCH_ADMIN: [
    "students:create", "students:read", "students:update",
    "staff:create", "staff:read", "staff:update",
    "attendance:create", "attendance:read", "attendance:update",
    "exams:create", "exams:read", "exams:update", "exams:grade",
    "timetable:read", "timetable:manage",
    "fees:create", "fees:read", "fees:update", "fees:approve",
    "notices:create", "notices:read", "notices:update",
    "events:create", "events:read", "events:update",
    "reports:read", "reports:export",
    "subjects:create", "subjects:read", "subjects:update", "subjects:delete",
    "classes:create", "classes:read", "classes:update", "classes:delete",
    "academic_years:read",
    "branches:read",
    "admissions:create", "admissions:read", "admissions:update", "admissions:inquiry_desk", "admissions:document_verification", "admissions:entrance_exam", "admissions:registrar_desk",
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
    "reports:read",
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
    "reports:read", "reports:export",
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

export interface NavItemType {
  label: string;
  href?: string;
  icon: string;
  roles?: "all";
  permission?: string;
  children?: NavItemType[];
}

/**
 * Sidebar navigation items per role.
 */
export const NAVIGATION_ITEMS: NavItemType[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", roles: "all" },
  {
    label: "Academics",
    icon: "school",
    children: [
      { label: "Academic Years", href: "/academic-years", icon: "date_range", permission: "academic_years:read" },
      { label: "Subjects", href: "/subject-masters", icon: "menu_book", permission: "subjects:read" },
      { label: "Classes", href: "/classes", icon: "class", permission: "classes:read" },
    ]
  },
  {
    label: "People",
    icon: "group",
    children: [
      { label: "Admissions", href: "/admissions", icon: "app_registration", permission: "admissions:inquiry_desk,admissions:document_verification,admissions:entrance_exam,admissions:registrar_desk" },
      { label: "Students", href: "/students", icon: "person", permission: "students:read" },
      { label: "Staff", href: "/staff", icon: "badge", permission: "staff:read" },
    ]
  },
  {
    label: "Financials",
    icon: "payments",
    children: [
      { label: "Fees", href: "/fees", icon: "account_balance_wallet", permission: "fees:read" },
    ]
  },
  {
    label: "Communication",
    icon: "campaign",
    children: [
      { label: "Notices", href: "/notices", icon: "notifications", permission: "notices:read" },
    ]
  },
  {
    label: "Administration",
    icon: "settings",
    children: [
      { label: "Branches", href: "/branches", icon: "location_city", permission: "branches:manage" },
      { label: "Users", href: "/users", icon: "manage_accounts", permission: "users:read" },
      { label: "Roles", href: "/roles", icon: "security", permission: "settings:manage" },
      { label: "Fee Categories", href: "/fee-categories", icon: "category", permission: "settings:manage" },
      { label: "School Settings", href: "/settings", icon: "build", permission: "settings:manage" },
    ]
  }
];
