"use client";

import { useState } from "react";
import { Search, Disc, Clock, Zap, Music2, CheckCircle2, Circle } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { MOCK_CATALOGUE } from "@/lib/darksco-data";
import type { CatalogueTrack, ReleaseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<ReleaseStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  "released":    { label: "RELEASED",    color: "#4dffa0", bg: "bg-[#4dffa0]/10", border: "border-[#4dffa0]/30", dot: "bg-[#4dffa0]" },
  "ready":       { label: "READY",       color: "#4dffa0", bg: "bg-[#4dffa0]/10", border: "border-[#4dffa0]/30", dot: "bg-[#4dffa0]" },
  "in-progress": { label: "IN PROGRESS", color: "#4d9fff", bg: "bg-[#4d9fff]/10", border: "border-[#4d9fff]/30", dot: "bg-[#4d9fff] pulse-dot" },
  "blocked":     { label: "BLOCKED",     color: "#ff4d4d", bg: "bg-[#ff4d4d]/10", border: "border-[#ff4d4d]/30", dot: "bg-[#ff4d4d]" },
};

type FilterStatus = "all" | ReleaseStatus;

function TrackCard({ track }: { track: CatalogueTrack }) {
  const sc = STATUS_CONFIG[track.status];

  return (
    <article className="rounded-lg border border-border bg-card hover:bg-surface-raised transition-colors p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
            <Disc className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground leading-none">
              {track.name}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {track.version}
            </div>
          </div>
        </div>

        <span
          className={cn(
            "flex items-center gap-1.5 text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border shrink-0",
            sc.bg, sc.border
          )}
          style={{ color: sc.color }}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
          {sc.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-brand" />
          <span className="font-mono">{track.bpm} BPM</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="font-mono">{track.duration}</span>
        </div>
        {track.releasedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-[#4dffa0]" />
            <span suppressHydrationWarning>
              {new Date(track.releasedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {track.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-dim"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function CataloguePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const filtered = MOCK_CATALOGUE.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.version.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const releasedCount = MOCK_CATALOGUE.filter((t) => t.status === "released").length;
  const inProgressCount = MOCK_CATALOGUE.filter((t) => t.status === "in-progress").length;

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Catalogue"
        subtitle={`${MOCK_CATALOGUE.length} tracks · ${releasedCount} released · ${inProgressCount} in progress`}
      />

      <div className="flex flex-col flex-1 min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracks..."
              className="w-full h-8 pl-8 pr-3 rounded border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {(["all", "released", "in-progress", "blocked"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  statusFilter === f
                    ? "bg-surface-raised text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "all" ? "All" : f === "in-progress" ? "In progress" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Production timeline */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Production Timeline
          </h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-0">
              {MOCK_CATALOGUE.map((track, i) => {
                const sc = STATUS_CONFIG[track.status];
                const isLast = i === MOCK_CATALOGUE.length - 1;
                return (
                  <div key={track.id} className="flex items-center gap-0 flex-1 min-w-0">
                    <div className="flex flex-col items-center min-w-0">
                      <div
                        className={cn("w-3 h-3 rounded-full border-2 shrink-0")}
                        style={{ borderColor: sc.color, backgroundColor: track.status === "released" ? sc.color : "transparent" }}
                      />
                      <div className="text-[9px] font-mono text-center mt-1 truncate w-16 text-muted-foreground">
                        {track.name.split(" ").slice(0, 2).join(" ")}
                      </div>
                      <div className="text-[8px] text-center" style={{ color: sc.color }}>
                        {track.version}
                      </div>
                    </div>
                    {!isLast && (
                      <div
                        className="flex-1 h-px mx-1"
                        style={{
                          backgroundColor:
                            track.status === "released" ? "#4dffa040" : "#222228",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Track grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Music2 className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No tracks match your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((track) => (
                <TrackCard key={track.id} track={track} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
