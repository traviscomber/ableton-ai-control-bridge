// Music Production Flow - TypeScript Types & Database Schema

export interface SoundDesignProfile {
  id: string;
  project_id: string;
  name: string;
  style: string; // e.g., "dark techno", "ambient", "experimental"
  description: string;
  bpm?: number;
  key?: string;
  time_signature?: string;
  mood_keywords: string[]; // e.g., ["cinematic", "intense", "atmospheric"]
  instrumentation: string[]; // e.g., ["pad", "bass", "drums", "strings"]
  reference_tracks?: string[]; // URLs or IDs
  production_stage: 'brief' | 'in-progress' | 'soundbank-ready' | 'approved' | 'archived';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Soundbank {
  id: string;
  project_id: string;
  profile_id: string; // FK to sound_design_profiles
  name: string;
  description: string;
  version: number; // v1, v2, etc
  status: 'draft' | 'stems-collected' | 'clips-extracted' | 'quality-check' | 'approved' | 'released';
  total_stems: number;
  total_clips: number;
  duration_seconds?: number;
  key?: string;
  bpm?: number;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  release_date?: string;
}

export interface Stem {
  id: string;
  soundbank_id: string; // FK to soundbanks
  name: string;
  instrument_type: string; // e.g., "bass", "pad", "drum", "lead", "fx"
  category: string; // e.g., "melodic", "percussive", "textural"
  file_path: string; // Vercel Blob storage path
  file_size: number; // bytes
  duration_seconds: number;
  sample_rate: number; // e.g., 44100, 48000
  bit_depth: number; // e.g., 24, 32
  format: string; // e.g., "WAV", "AIFF"
  metadata: {
    frequency_range?: [number, number]; // [low, high] Hz
    dynamics?: string; // "dynamic", "sustain", "percussive"
    processing?: string[]; // e.g., ["reverb", "delay", "compression"]
  };
  upload_date: string;
  quality_score?: number; // 0-100 from Venom
  status: 'raw' | 'processed' | 'approved';
}

export interface Clip {
  id: string;
  stem_id: string; // FK to stems
  soundbank_id: string;
  name: string;
  start_time: number; // seconds
  end_time: number; // seconds
  duration_seconds: number;
  loop_points?: {
    start: number;
    end: number;
  };
  tempo_sync?: boolean;
  file_path: string; // Vercel Blob storage path
  waveform_data?: string; // JSON array or image data for UI preview
  tags: string[]; // e.g., ["attack", "sustain", "tail", "loop-ready"]
  metadata: {
    key?: string;
    frequency_peak?: number;
    loudness_db?: number;
    transient_count?: number;
  };
  created_at: string;
  updated_at: string;
  quality_score?: number; // 0-100 from Venom
}

export interface ClipVersion {
  id: string;
  clip_id: string; // FK to clips
  version_number: number;
  changes_made: string; // e.g., "normalized audio", "added fade-in"
  file_path: string;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

export interface ProductionFeedback {
  id: string;
  soundbank_id: string;
  agent_id: string; // e.g., "venom", "hela", "loki"
  feedback_type: 'quality-score' | 'revision-request' | 'approval' | 'blocker';
  score?: number; // 0-100
  findings: string[];
  recommendations: string[];
  blockers?: string[];
  decision: 'approve' | 'revise' | 'reject';
  required_revisions?: {
    stem_id?: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  created_at: string;
  agent_response?: Record<string, unknown>; // Full agent response stored as JSONB
}

export interface SoundbankRelease {
  id: string;
  soundbank_id: string;
  workflow_id: string; // FK to darksco_workflows
  release_status: 'pending' | 'in-approval' | 'approved' | 'released' | 'archived';
  quality_gate_status: Record<string, 'passed' | 'failed' | 'pending'>;
  release_notes: string;
  released_at?: string;
  released_by?: string;
}

// Supabase Table Definitions (SQL)
export const MUSIC_PRODUCTION_SCHEMA = `
-- Sound Design Profiles
CREATE TABLE IF NOT EXISTS sound_design_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  style TEXT NOT NULL,
  description TEXT,
  bpm INTEGER,
  key TEXT,
  time_signature TEXT DEFAULT '4/4',
  mood_keywords TEXT[] DEFAULT '{}',
  instrumentation TEXT[] DEFAULT '{}',
  reference_tracks TEXT[],
  production_stage TEXT DEFAULT 'brief' CHECK (production_stage IN ('brief', 'in-progress', 'soundbank-ready', 'approved', 'archived')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT NOT NULL,
  UNIQUE(project_id, name)
);

-- Soundbanks
CREATE TABLE IF NOT EXISTS soundbanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES sound_design_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'stems-collected', 'clips-extracted', 'quality-check', 'approved', 'released')),
  total_stems INTEGER DEFAULT 0,
  total_clips INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  key TEXT,
  bpm INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  release_date TIMESTAMP,
  UNIQUE(profile_id, version)
);

-- Stems
CREATE TABLE IF NOT EXISTS stems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soundbank_id UUID NOT NULL REFERENCES soundbanks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  category TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  sample_rate INTEGER NOT NULL,
  bit_depth INTEGER NOT NULL,
  format TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  upload_date TIMESTAMP DEFAULT NOW(),
  quality_score INTEGER,
  status TEXT DEFAULT 'raw' CHECK (status IN ('raw', 'processed', 'approved')),
  UNIQUE(soundbank_id, name)
);

-- Clips
CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stem_id UUID NOT NULL REFERENCES stems(id) ON DELETE CASCADE,
  soundbank_id UUID NOT NULL REFERENCES soundbanks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  duration_seconds NUMERIC GENERATED ALWAYS AS (end_time - start_time) STORED,
  loop_points JSONB,
  tempo_sync BOOLEAN DEFAULT FALSE,
  file_path TEXT NOT NULL,
  waveform_data TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  quality_score INTEGER,
  UNIQUE(stem_id, start_time, end_time)
);

-- Clip Versions
CREATE TABLE IF NOT EXISTS clip_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes_made TEXT,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE
);

-- Production Feedback
CREATE TABLE IF NOT EXISTS production_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soundbank_id UUID NOT NULL REFERENCES soundbanks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('quality-score', 'revision-request', 'approval', 'blocker')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  findings TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  blockers TEXT[],
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'revise', 'reject')),
  required_revisions JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  agent_response JSONB,
  INDEX idx_soundbank_feedback (soundbank_id),
  INDEX idx_agent_feedback (agent_id)
);

-- Soundbank Releases (linking to DARKSCO workflow)
CREATE TABLE IF NOT EXISTS soundbank_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soundbank_id UUID NOT NULL REFERENCES soundbanks(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES darksco_workflows(id),
  release_status TEXT DEFAULT 'pending' CHECK (release_status IN ('pending', 'in-approval', 'approved', 'released', 'archived')),
  quality_gate_status JSONB DEFAULT '{}',
  release_notes TEXT,
  released_at TIMESTAMP,
  released_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(soundbank_id)
);

-- Enable RLS
ALTER TABLE sound_design_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE soundbanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stems ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE soundbank_releases ENABLE ROW LEVEL SECURITY;

-- Create Indexes
CREATE INDEX idx_profiles_project ON sound_design_profiles(project_id);
CREATE INDEX idx_profiles_stage ON sound_design_profiles(production_stage);
CREATE INDEX idx_soundbanks_project ON soundbanks(project_id);
CREATE INDEX idx_soundbanks_status ON soundbanks(status);
CREATE INDEX idx_soundbanks_profile ON soundbanks(profile_id);
CREATE INDEX idx_stems_soundbank ON stems(soundbank_id);
CREATE INDEX idx_stems_status ON stems(status);
CREATE INDEX idx_clips_soundbank ON clips(soundbank_id);
CREATE INDEX idx_clips_stem ON clips(stem_id);
CREATE INDEX idx_feedback_soundbank ON production_feedback(soundbank_id);
CREATE INDEX idx_feedback_agent ON production_feedback(agent_id);
`;
