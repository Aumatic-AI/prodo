import {
  LayoutDashboard,
  Images,
  Send,
  CalendarDays,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Media",     href: "/media",     icon: Images },
  { label: "Posts",     href: "/posts",     icon: Send },
  { label: "Calendar",  href: "/calendar",  icon: CalendarDays },
  { label: "Settings",  href: "/settings",  icon: Settings },
];
