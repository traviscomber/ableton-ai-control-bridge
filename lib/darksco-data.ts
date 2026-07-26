import type { Agent, AgentId, DarkscoProject, CatalogueTrack } from "./types";

export const AGENTS: Agent[] = [
  {
    id: "darkside",
    name: "Darkside",
    role: "Orchestrator",
    authority: "Task routing and execution coordination",
    color: "#4dffa0",
  },
  {
    id: "doom",
    name: "Doom",
    role: "Strategic Director",
    authority: "Priorities, releases, major commitments",
    color: "#ff6b4d",
  },
  {
    id: "venom",
    name: "Venom",
    role: "Music Executive",
    authority: "Musical approval",
    color: "#4d9fff",
  },
  {
    id: "hela",
    name: "Hela",
    role: "Visual Executive",
    authority: "Visual approval",
    color: "#c44dff",
  },
  {
    id: "loki",
    name: "Loki",
    role: "Publishing Executive",
    authority: "Publishing readiness",
    color: "#ffd94d",
  },
  {
    id: "bane",
    name: "Bane",
    role: "Intelligence Executive",
    authority: "Evidence quality and experiment validity",
    color: "#4dffe8",
  },
  {
    id: "thanos",
    name: "Thanos",
    role: "Business & Rights",
    authority: "Rights and commercial readiness",
    color: "#ff4d9f",
  },
];

export const AGENT_MAP: Record<AgentId, Agent> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a])
) as Record<AgentId, Agent>;

// ─── Mock active project ────────────────────────────────────────────────────

export const MOCK_ACTIVE_PROJECT: DarkscoProject = {
  id: "night-protocol-002",
  name: "Night Protocol 002",
  version: "v0.4",
  status: "in-progress",
  bpm: 134,
  duration: "6:42",
  createdAt: "2026-07-24T20:00:00Z",
  updatedAt: "2026-07-26T14:30:00Z",
  gates: [
    { key: "music",        label: "Music",       owner: "venom",   passed: true },
    { key: "visual",       label: "Visual",      owner: "hela",    passed: false, blockedReason: "Thumbnail draft pending review" },
    { key: "publishing",   label: "Publishing",  owner: "loki",    passed: false },
    { key: "evidence",     label: "Evidence",    owner: "bane",    passed: false },
    { key: "rights",       label: "Rights",      owner: "thanos",  passed: true },
    { key: "doom_approval",label: "Final Gate",  owner: "doom",    passed: false },
  ],
  agents: {
    darkside: {
      status: "ACTIVE",
      confidence: "HIGH",
      summary: "Routing Night Protocol 002 release pipeline. 4 agents active, 2 gates cleared.",
      actions: ["Waiting on Hela visual approval", "Bane measurement plan due EOD"],
      updatedAt: "2026-07-26T14:30:00Z",
    },
    venom: {
      status: "READY",
      confidence: "HIGH",
      summary: "Master approved. Drum revision complete. Bass tuning verified. Call-and-response structure locked.",
      actions: ["Deliver final WAV to Loki"],
      updatedAt: "2026-07-26T12:00:00Z",
    },
    hela: {
      status: "BLOCKED",
      confidence: "MEDIUM",
      summary: "Visual direction set. Thumbnail draft in progress. Cover artwork blocked on font license.",
      blockers: ["Font license for Neue Haas unresolved"],
      updatedAt: "2026-07-26T11:00:00Z",
    },
    loki: {
      status: "PENDING",
      confidence: "MEDIUM",
      summary: "Publishing package 70% complete. Awaiting final audio file and visual assets.",
      actions: ["Draft metadata", "Prepare caption set"],
      updatedAt: "2026-07-26T10:00:00Z",
    },
    bane: {
      status: "ACTIVE",
      confidence: "MEDIUM",
      summary: "Defining baseline KPIs for Night Protocol series. Previous 3 releases analyzed.",
      actions: ["Complete measurement plan", "Submit to Doom"],
      updatedAt: "2026-07-26T13:00:00Z",
    },
    thanos: {
      status: "READY",
      confidence: "HIGH",
      summary: "Rights cleared. All samples original. No third-party clearances required. Commercial use approved.",
      updatedAt: "2026-07-25T18:00:00Z",
    },
    doom: {
      status: "PENDING",
      confidence: "LOW",
      summary: "Awaiting consolidated reports from Hela and Bane before final decision.",
      blockers: ["Visual gate not cleared", "Evidence review incomplete"],
      updatedAt: "2026-07-26T09:00:00Z",
    },
  },
};

// ─── Mock catalogue ─────────────────────────────────────────────────────────

export const MOCK_CATALOGUE: CatalogueTrack[] = [
  {
    id: "solar-dialogue-v06",
    name: "Solar Dialogue",
    version: "v0.6",
    bpm: 118,
    duration: "5:58",
    status: "released",
    releasedAt: "2026-07-20",
    tags: ["ambient", "day-cycle", "MIDI"],
  },
  {
    id: "sunline-motion-v02",
    name: "Sunline Motion",
    version: "v0.2",
    bpm: 122,
    duration: "5:14",
    status: "in-progress",
    tags: ["call-response", "bass", "MIDI"],
  },
  {
    id: "night-protocol-001",
    name: "Night Protocol 001",
    version: "v1.0",
    bpm: 130,
    duration: "6:10",
    status: "released",
    releasedAt: "2026-07-22",
    tags: ["night-cycle", "dark", "MIDI"],
  },
  {
    id: "night-protocol-002",
    name: "Night Protocol 002",
    version: "v0.4",
    bpm: 134,
    duration: "6:42",
    status: "in-progress",
    tags: ["night-cycle", "dark", "MIDI"],
  },
  {
    id: "neon-basement-ritual",
    name: "Neon Basement Ritual",
    version: "v0.1",
    bpm: 140,
    duration: "4:30",
    status: "in-progress",
    tags: ["experimental", "bass", "MIDI"],
  },
];
