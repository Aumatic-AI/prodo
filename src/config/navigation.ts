import { Activity, BarChart3, CalendarDays, Coins, Images, LayoutGrid, LineChart, Send, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Shown as one row that opens to its items (open by itself on one of its pages) */
  collapsible?: { icon: LucideIcon };
}

/** Sidebar sections, top to bottom. Settings sits at the bottom on its own (SETTINGS_ITEM). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Plan",
    items: [
      { label: "This week", href: "/week", icon: LayoutGrid },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Media", href: "/media", icon: Images },
      { label: "Posts", href: "/posts", icon: Send },
    ],
  },
  {
    label: "Brand",
    items: [{ label: "Brand", href: "/brand", icon: Sparkles }],
  },
  {
    label: "Insights",
    collapsible: { icon: BarChart3 },
    items: [
      { label: "Performance", href: "/performance", icon: LineChart },
      { label: "Activity", href: "/activity", icon: Activity },
      { label: "Costs", href: "/costs", icon: Coins },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { label: "Settings", href: "/settings", icon: Settings };

export const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];
