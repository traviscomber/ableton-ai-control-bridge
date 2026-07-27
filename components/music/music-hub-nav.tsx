"use client";

import Link from "next/link";
import { Music, Home, Disc3, Radio, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";

export function MusicHubNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Hub", href: "/music-hub", icon: LayoutGrid },
    { label: "Create Project", href: "/music", icon: Music },
    { label: "Workflows", href: "/darksco/workflows", icon: Radio },
    { label: "Pipeline", href: "/darksco/pipeline", icon: Disc3 },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/music-hub" className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">Music Studio</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
