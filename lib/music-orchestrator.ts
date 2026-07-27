// Music Production Orchestrator - Unified workflow management
// Coordinates: Sound Design → Soundbank → Validation → DARKSCO Release

import { createClient } from "@/lib/supabase/server";

export interface MusicProject {
  id: string;
  projectId: string;
  name: string;
  style: string;
  status: "design" | "soundbank" | "clips" | "validation" | "approval" | "released";
  currentPhase: "brief" | "stems" | "extraction" | "soundsmith" | "venom" | "darksco";
  progress: {
    profileComplete: boolean;
    soundbankCreated: boolean;
    stemsUploaded: number;
    clipsExtracted: number;
    soundsmithValidated: boolean;
    venomScored: boolean;
    darkscoApproved: boolean;
  };
  timeline: {
    profileCreatedAt: string;
    soundbankCreatedAt?: string;
    stemsCompletedAt?: string;
    soundsmithApprovedAt?: string;
    venomApprovedAt?: string;
    darkscoApprovedAt?: string;
  };
  metrics: {
    totalStems: number;
    totalClips: number;
    soundsmithScore?: number;
    venomScore?: number;
    blockers: string[];
    nextActionRequired?: string;
  };
  nextSteps: ProjectAction[];
}

export interface ProjectAction {
  id: string;
  phase: string;
  action: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  dueDate?: string;
  assignedTo?: string;
  notes?: string;
}

export interface ProjectDashboard {
  activeProject: MusicProject;
  recentProjects: MusicProject[];
  stats: {
    totalProjects: number;
    inProgress: number;
    readyForApproval: number;
    released: number;
  };
  nextMilestone: {
    project: MusicProject;
    phase: string;
    action: string;
    daysUntil: number;
  } | null;
}

export class MusicProductionOrchestrator {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Get unified project dashboard
   */
  async getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
    const profile = await this.supabase
      .from("sound_design_profiles")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (profile.error) throw profile.error;

    const soundbanks = await this.supabase
      .from("soundbanks")
      .select("*")
      .eq("project_id", projectId);

    const recentProfiles = await this.supabase
      .from("sound_design_profiles")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(5);

    const activeProject = await this.buildMusicProject(
      profile.data,
      soundbanks.data || []
    );

    const recentProjects = await Promise.all(
      (recentProfiles.data || []).map((p: any) =>
        this.buildMusicProject(p, soundbanks.data || [])
      )
    );

    const stats = await this.getProjectStats(projectId);
    const nextMilestone = await this.getNextMilestone(projectId);

    return {
      activeProject,
      recentProjects,
      stats,
      nextMilestone,
    };
  }

  /**
   * Build comprehensive project view
   */
  private async buildMusicProject(
    profile: any,
    soundbanks: any[]
  ): Promise<MusicProject> {
    const soundbank = soundbanks.find((sb) => sb.profile_id === profile.id);

    // Determine current phase and status
    let currentPhase: any = "brief";
    let status: any = "design";

    if (!soundbank) {
      currentPhase = "brief";
      status = "design";
    } else if (soundbank.status === "draft") {
      currentPhase = "stems";
      status = "soundbank";
    } else if (soundbank.status === "stems-collected") {
      currentPhase = "extraction";
      status = "clips";
    } else if (soundbank.status === "clips-extracted") {
      currentPhase = "soundsmith";
      status = "validation";
    } else if (soundbank.status === "quality-check") {
      currentPhase = "venom";
      status = "approval";
    } else if (soundbank.status === "approved") {
      currentPhase = "darksco";
      status = "approval";
    } else if (soundbank.status === "released") {
      currentPhase = "darksco";
      status = "released";
    }

    // Get stems and clips
    const stems = soundbank
      ? await this.supabase
          .from("stems")
          .select("*")
          .eq("soundbank_id", soundbank.id)
      : { data: [] };

    const clips = soundbank
      ? await this.supabase
          .from("clips")
          .select("*")
          .eq("soundbank_id", soundbank.id)
      : { data: [] };

    // Get feedback
    const feedback = soundbank
      ? await this.supabase
          .from("production_feedback")
          .select("*")
          .eq("soundbank_id", soundbank.id)
          .order("created_at", { ascending: false })
      : { data: [] };

    const soundsmithFeedback = feedback.data?.find(
      (f: any) => f.agent_id === "soundsmith"
    );
    const venomFeedback = feedback.data?.find((f: any) => f.agent_id === "venom");

    // Calculate next steps
    const nextSteps = this.getProjectNextSteps(
      profile,
      soundbank,
      stems.data || [],
      soundsmithFeedback,
      venomFeedback
    );

    return {
      id: profile.id,
      projectId: profile.project_id,
      name: profile.name,
      style: profile.style,
      status,
      currentPhase,
      progress: {
        profileComplete: !!profile.id,
        soundbankCreated: !!soundbank,
        stemsUploaded: (stems.data || []).length,
        clipsExtracted: (clips.data || []).length,
        soundsmithValidated: soundsmithFeedback?.decision === "approve",
        venomScored: !!venomFeedback?.score,
        darkscoApproved: soundbank?.status === "released",
      },
      timeline: {
        profileCreatedAt: profile.created_at,
        soundbankCreatedAt: soundbank?.created_at,
        stemsCompletedAt:
          (stems.data || []).length > 0
            ? (stems.data || [])[0].upload_date
            : undefined,
        soundsmithApprovedAt: soundsmithFeedback?.created_at,
        venomApprovedAt: venomFeedback?.created_at,
        darkscoApprovedAt: soundbank?.approved_at,
      },
      metrics: {
        totalStems: (stems.data || []).length,
        totalClips: (clips.data || []).length,
        soundsmithScore: soundsmithFeedback?.score,
        venomScore: venomFeedback?.score,
        blockers: [
          ...(soundsmithFeedback?.blockers || []),
          ...(venomFeedback?.blockers || []),
        ],
        nextActionRequired:
          soundsmithFeedback?.recommendation ||
          venomFeedback?.recommendation,
      },
      nextSteps,
    };
  }

  /**
   * Calculate next action steps
   */
  private getProjectNextSteps(
    profile: any,
    soundbank: any,
    stems: any[],
    soundsmithFeedback: any,
    venomFeedback: any
  ): ProjectAction[] {
    const steps: ProjectAction[] = [];

    // Phase 1: Design
    if (!soundbank) {
      steps.push({
        id: "create-soundbank",
        phase: "soundbank",
        action: "Create soundbank and upload stems",
        status: "pending",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return steps;
    }

    // Phase 2: Stems
    if (soundbank.status === "draft" && stems.length === 0) {
      steps.push({
        id: "upload-stems",
        phase: "stems",
        action: `Upload at least 3 stems (currently: ${stems.length})`,
        status: "in-progress",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return steps;
    }

    // Phase 3: Clips
    if (soundbank.status === "stems-collected") {
      steps.push({
        id: "extract-clips",
        phase: "extraction",
        action: "Extract clips from uploaded stems",
        status: "pending",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return steps;
    }

    // Phase 4: Validation
    if (soundbank.status === "clips-extracted") {
      steps.push({
        id: "soundsmith-validation",
        phase: "soundsmith",
        action: "Run Soundsmith validation",
        status: "pending",
        dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      });
      return steps;
    }

    // Phase 5: Quality Check
    if (soundbank.status === "quality-check" && !venomFeedback) {
      steps.push({
        id: "venom-scoring",
        phase: "venom",
        action: "Request Venom quality scoring (100-point assessment)",
        status: "pending",
        dueDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      });
      return steps;
    }

    // Phase 6: Revisions (if blocked)
    if (soundsmithFeedback?.blockers?.length > 0) {
      steps.push({
        id: "address-blockers",
        phase: "soundsmith",
        action: `Address ${soundsmithFeedback.blockers.length} blocker(s)`,
        status: "blocked",
        notes: soundsmithFeedback.blockers.join("; "),
      });
    }

    if (venomFeedback?.decision === "revise") {
      steps.push({
        id: "venom-revisions",
        phase: "venom",
        action: `Implement Venom feedback (Score: ${venomFeedback.score}/100)`,
        status: "in-progress",
        notes: venomFeedback.recommendations?.join("; "),
      });
    }

    // Phase 7: DARKSCO
    if (
      soundsmithFeedback?.decision === "approve" &&
      venomFeedback?.decision === "approve"
    ) {
      steps.push({
        id: "darksco-workflow",
        phase: "darksco",
        action: "Send to DARKSCO workflow for final approval",
        status: "pending",
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });
    }

    return steps;
  }

  /**
   * Get overall project statistics
   */
  private async getProjectStats(projectId: string) {
    const projects = await this.supabase
      .from("sound_design_profiles")
      .select("*")
      .eq("project_id", projectId);

    const soundbanks = await this.supabase
      .from("soundbanks")
      .select("*")
      .eq("project_id", projectId);

    const released = (soundbanks.data || []).filter(
      (sb: any) => sb.status === "released"
    );
    const inProgress = (soundbanks.data || []).filter(
      (sb: any) =>
        ["draft", "stems-collected", "clips-extracted", "quality-check"].includes(
          sb.status
        )
    );
    const readyForApproval = (soundbanks.data || []).filter(
      (sb: any) => sb.status === "approved"
    );

    return {
      totalProjects: (projects.data || []).length,
      inProgress: inProgress.length,
      readyForApproval: readyForApproval.length,
      released: released.length,
    };
  }

  /**
   * Get next milestone across all projects
   */
  private async getNextMilestone(projectId: string) {
    const profiles = await this.supabase
      .from("sound_design_profiles")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if ((profiles.data || []).length === 0) {
      return null;
    }

    const profile = profiles.data[0];
    const soundbanks = await this.supabase
      .from("soundbanks")
      .select("*")
      .eq("profile_id", profile.id)
      .limit(1);

    const soundbank = (soundbanks.data || [])[0];

    const project = await this.buildMusicProject(profile, soundbanks.data || []);
    const nextAction = project.nextSteps[0];

    if (!nextAction) {
      return null;
    }

    const daysUntil = nextAction.dueDate
      ? Math.ceil(
          (new Date(nextAction.dueDate).getTime() - Date.now()) / 
          (1000 * 60 * 60 * 24)
        )
      : 0;

    return {
      project,
      phase: nextAction.phase,
      action: nextAction.action,
      daysUntil,
    };
  }

  /**
   * Quick transition between phases
   */
  async transitionPhase(
    soundbankId: string,
    toPhase: string
  ): Promise<{ success: boolean; nextPhase: string }> {
    const phaseMap: Record<string, string> = {
      brief: "draft",
      stems: "stems-collected",
      extraction: "clips-extracted",
      soundsmith: "quality-check",
      venom: "approved",
      darksco: "released",
    };

    const newStatus = phaseMap[toPhase];

    if (!newStatus) {
      throw new Error(`Invalid phase: ${toPhase}`);
    }

    const { error } = await this.supabase
      .from("soundbanks")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", soundbankId);

    if (error) throw error;

    return {
      success: true,
      nextPhase: toPhase,
    };
  }
}

export async function getOrchestrator() {
  const supabase = await createClient();
  return new MusicProductionOrchestrator(supabase);
}
