import { LayoutDashboard, Images, Send, CalendarDays, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar sections, top to bottom. Settings sits at the bottom on its own (SETTINGS_ITEM). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Content",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Media", href: "/media", icon: Images },
      { label: "Posts", href: "/posts", icon: Send },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Brand",
    items: [{ label: "Brand", href: "/brand", icon: Sparkles }],
  },
];

export const SETTINGS_ITEM: NavItem = { label: "Settings", href: "/settings", icon: Settings };

export const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];
