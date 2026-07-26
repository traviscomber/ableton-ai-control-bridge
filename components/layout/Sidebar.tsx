"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Clock,
  Heart,
  LayoutGrid,
  Library,
  ListChecks,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BRIDGE_NAV = [
  { href: "/bridge/queue",   label: "Queue",   icon: ListChecks },
  { href: "/bridge/history", label: "History", icon: Clock },
  { href: "/bridge/health",  label: "Health",  icon: Activity },
];

const DARKSCO_NAV = [
  { href: "/darksco",           label: "Agents",    icon: LayoutGrid },
  { href: "/darksco/catalogue", label: "Catalogue", icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-col w-56 min-h-screen border-r border-border bg-background shrink-0"
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-brand">
          <Zap className="w-4 h-4 text-background" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground leading-none">
            AI Bridge
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">v0.4.2</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-6 px-3 py-4 overflow-y-auto">
        {/* Bridge section */}
        <section>
          <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Bridge
          </div>
          <ul className="flex flex-col gap-0.5">
            {BRIDGE_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors",
                      active
                        ? "bg-surface-raised text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-raised"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", active && "text-brand")} />
                    {label}
                    {active && (
                      <span className="ml-auto w-1 h-1 rounded-full bg-brand" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* DARKSCO section */}
        <section>
          <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            DARKSCO
          </div>
          <ul className="flex flex-col gap-0.5">
            {DARKSCO_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/darksco" && pathname.startsWith(href));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors",
                      active
                        ? "bg-surface-raised text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-raised"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", active && "text-brand")} />
                    {label}
                    {active && (
                      <span className="ml-auto w-1 h-1 rounded-full bg-brand" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-1.5">
          <Heart className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">DARKSCO</span>
        </div>
      </div>
    </nav>
  );
}
