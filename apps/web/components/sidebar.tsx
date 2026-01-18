"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Database,
  Users,
  Settings,
  Zap,
  Palette,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Connections", href: "/connections", icon: Database },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Design Kit", href: "/design-kit", icon: Palette },
];

export function Sidebar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-[hsl(var(--sidebar-bg))]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-accent">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="font-semibold text-foreground">Maetrik</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-accent text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle & Footer */}
      <div className="border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{isDark ? "Dark" : "Light"}</span>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
        <p className="text-xs text-muted-foreground">v0.0.1</p>
      </div>
    </aside>
  );
}
