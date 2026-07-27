"use client";

interface TopBarProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function TopBar({ title, subtitle, right }: TopBarProps) {
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
      </div>
    </header>
  );
}
