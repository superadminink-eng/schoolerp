"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  BadgeCent,
  Calendar,
  BookOpen,
  GraduationCap,
  Landmark,
  Menu,
  ChevronDown,
  Check,
  User,
  LogOut,
  CircleDashed,
  Settings,
  Search,
  Plus,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Filter,
  ArrowLeft,
  Cake,
  Phone,
  XCircle,
  CheckCircle,
  CalendarOff,
  UserPlus,
  Home,
  Key,
  MapPinOff,
  Lock,
  RotateCcw,
  LogIn,
  Mail,
  UserCog,
  Save,
  Eye,
  EyeOff,
  Star,
  Tag,
  Upload,
  UserX,
  Receipt,
  ClipboardSignature
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number;
  filled?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  location_city: Building2,
  domain: Building2,
  domain_disabled: Building2,
  group: Users,
  people: Users,
  groups: Users,
  security: ShieldCheck,
  badge: BadgeCent,
  date_range: Calendar,
  event: Calendar,
  event_busy: CalendarOff,
  menu_book: BookOpen,
  class: GraduationCap,
  school: GraduationCap,
  payments: Landmark,
  menu: Menu,
  expand_more: ChevronDown,
  check: Check,
  person: User,
  logout: LogOut,
  settings: Settings,
  admin_panel_settings: ShieldCheck,
  search: Search,
  search_off: Search,
  add: Plus,
  chevron_right: ChevronRight,
  more_vert: MoreVertical,
  edit: Pencil,
  delete: Trash2,
  filter_list: Filter,
  person_add: UserPlus,
  group_add: UserPlus,
  person_off: UserX,
  group_off: UserX,
  arrow_back: ArrowLeft,
  cake: Cake,
  call: Phone,
  phone: Phone,
  cancel: XCircle,
  check_circle: CheckCircle,
  home: Home,
  key: Key,
  location_off: MapPinOff,
  lock: Lock,
  lock_reset: RotateCcw,
  login: LogIn,
  mail: Mail,
  manage_accounts: UserCog,
  receipt_long: Receipt,
  save: Save,
  star: Star,
  tag: Tag,
  upload: Upload,
  visibility: Eye,
  visibility_off: EyeOff,
  app_registration: ClipboardSignature,
};

export function Icon({
  name,
  size = 24,
  filled = false,
  className,
  ...props
}: IconProps) {
  const LucideComponent = iconMap[name] || CircleDashed;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center select-none",
        className
      )}
      {...props}
    >
      <LucideComponent
        size={size}
        strokeWidth={filled ? 2.5 : 2}
        className={cn(
          filled && (!className || !className.includes("text-")) && "text-primary"
        )}
      />
    </span>
  );
}
