"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function TopBar({ title, subtitle, right }: TopBarProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("bridgeToken") ?? "";
    setToken(stored);
  }, []);

  function handleTokenChange(v: string) {
    setToken(v);
    localStorage.setItem("bridgeToken", v);
  }

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-border bg-background shrink-0">
      <div className="flex flex-col">
        <h1 className="text-sm font-semibold text-foreground leading-none">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {right}

        {/* Token input */}
        <div className="relative flex items-center">
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="Bridge token"
            className="h-7 w-40 rounded border border-border bg-surface px-2.5 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            aria-label="Bridge authentication token"
          />
          <button
            type="button"
            onClick={() => setShowToken((p) => !p)}
            className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showToken ? "Hide token" : "Show token"}
          >
            {showToken ? (
              <EyeOff className="w-3 h-3" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
