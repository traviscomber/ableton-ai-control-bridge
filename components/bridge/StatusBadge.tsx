import { cn } from "@/lib/utils";
import type { CommandStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  CommandStatus,
  { label: string; className: string; dot: string }
> = {
  pending:      { label: "PENDING",      className: "text-[#f5a623] bg-[#f5a623]/10 border-[#f5a623]/30", dot: "bg-[#f5a623] pulse-dot" },
  accepted:     { label: "ACCEPTED",     className: "text-[#4dffa0] bg-[#4dffa0]/10 border-[#4dffa0]/30", dot: "bg-[#4dffa0]" },
  sent:         { label: "SENT",         className: "text-[#4d9fff] bg-[#4d9fff]/10 border-[#4d9fff]/30", dot: "bg-[#4d9fff] pulse-dot" },
  acknowledged: { label: "ACK",          className: "text-[#4dffa0] bg-[#4dffa0]/10 border-[#4dffa0]/30", dot: "bg-[#4dffa0]" },
  rejected:     { label: "REJECTED",     className: "text-[#ff4d4d] bg-[#ff4d4d]/10 border-[#ff4d4d]/30", dot: "bg-[#ff4d4d]" },
  error:        { label: "ERROR",        className: "text-[#ff4d4d] bg-[#ff4d4d]/10 border-[#ff4d4d]/30", dot: "bg-[#ff4d4d]" },
  simulated:    { label: "DRY-RUN",      className: "text-[#9898a4] bg-[#9898a4]/10 border-[#9898a4]/30", dot: "bg-[#9898a4]" },
};

interface StatusBadgeProps {
  status: CommandStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-widest",
        cfg.className,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
