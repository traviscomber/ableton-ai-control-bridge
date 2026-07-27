# Music Production Hub - Quick Reference Guide

## 🚀 Quick Start

### Visit the Hub
```
/music-hub
```
- See all music projects at a glance
- View project status, progress, and metrics
- Identify next actions and deadlines

### View Project Details
```
/music-hub/project/night-protocol-002
```
- See complete timeline of all 6 phases
- Review phase-specific metrics
- Open related project pages

### Create or Edit Project
```
/music
```
- Create new sound design profile
- Upload stems for soundbank
- Monitor workflow progress

### Access DARKSCO Workflows
```
/darksco/workflows
```
- View linked soundbanks
- See all 7-agent approval pipeline
- Check quality gates status

---

## 📊 Dashboard At a Glance

### Stats Cards (4 Columns)
| Card | Shows | Color |
|------|-------|-------|
| Total Projects | 5 | Blue |
| In Progress | 3 | Yellow |
| Ready for Approval | 1 | Orange |
| Released | 1 | Green |

### Project Cards
Each card displays:
- **Name & Style**: Project title and music style
- **Status Badge**: Color-coded current phase
- **Progress Bar**: 0-100% completion percentage
- **Metrics**: Stems count, clips count, quality score
- **Blockers**: Red alert if issues exist
- **Next Action**: What needs to happen next
- **Due Date**: Days until deadline

---

## 🎯 Workflow Phases

### Phase 1: DESIGN (🔵 Blue)
- **What**: Create sound design profile
- **Details**: Style, instrumentation, mood keywords
- **Output**: sound_design_profiles record
- **Next**: Create soundbank

### Phase 2: SOUNDBANK (🔵 Blue)
- **What**: Upload stems organized by instrument
- **Details**: Bass, pad, drums, FX, etc.
- **Output**: soundbanks + stems records
- **Next**: Extract clips

### Phase 3: CLIPS (🟣 Purple)
- **What**: Extract playable segments from stems
- **Details**: Optional loop points, tempo sync
- **Output**: clips + clip_versions records
- **Next**: Run Soundsmith validation

### Phase 4: VALIDATION (🟡 Yellow)
- **What**: Soundsmith assesses profile coherence
- **Details**: 4 scoring dimensions, quality checks
- **Score**: 0-100 coherence score
- **Decision**: VALID | INCOMPLETE | NEEDS_REVISION
- **Next**: Request Venom scoring (if valid)

### Phase 5: APPROVAL (🟠 Orange)
- **What**: Venom scores soundbank quality
- **Details**: 6 dimension assessment (Identity, Mix, Arrangement, etc.)
- **Score**: 0-100 quality score
- **Decision**: APPROVE (80+) | REVISE (60-79) | REJECT (<60)
- **Next**: DARKSCO workflow (if approved)

### Phase 6: RELEASE (🟢 Green)
- **What**: DARKSCO 7-agent approval pipeline
- **Details**: Venom, Hela, Loki, Bane, Thanos, Doom, Darkside
- **Gates**: 6 quality gates auto-updated
- **Decision**: APPROVED → RELEASED
- **Result**: Project complete and ready for distribution

---

## 🧠 Orchestrator Intelligence

### Auto Phase Detection
The system automatically detects current phase based on database state:

```
No soundbank        → Phase: "design" (0%)
Status: draft       → Phase: "stems" (15%)
Status: stems-collected → Phase: "extraction" (40%)
Status: clips-extracted → Phase: "soundsmith" (60%)
Status: quality-check   → Phase: "venom" (75%)
Status: approved        → Phase: "darksco" (90%)
Status: released        → Phase: "released" (100%)
```

### Smart Next Actions
Automatically suggests the next action based on current phase:

```
Design    → "Create soundbank and upload stems"
Soundbank → "Upload at least 3 stems"
Clips     → "Extract clips from uploaded stems"
Validation → "Run Soundsmith validation"
Approval  → "Request Venom quality scoring"
Release   → "Send to DARKSCO workflow"
```

### Blocker Detection
Automatically identifies issues:

```
Soundsmith.blockers[] present     → Red alert
Venom.decision === "revise"       → Orange alert
DARKSCO quality gate failed       → Red alert
Show: "Address X blockers"
```

---

## 📈 Metrics Tracked

### Per Project
- **Total Stems**: Number of uploaded stems
- **Total Clips**: Number of extracted clips
- **Soundsmith Score**: 0-100 coherence assessment
- **Venom Score**: 0-100 quality score
- **Blockers**: Array of blocking issues
- **Timeline**: Creation and approval dates
- **Progress**: 0-100% completion percentage

### Dashboard Statistics
- **Total Projects**: All profiles created
- **In Progress**: Soundbanks in active phases
- **Ready for Approval**: Approved, awaiting release
- **Released**: Final soundbanks with released status
- **Next Milestone**: Upcoming deadline with days remaining

---

## 🗓️ Status Indicators

### Color Coding
```
🔵 DESIGN     (Blue)     - Pending profile creation
🔵 SOUNDBANK  (Blue)     - Active stems upload
🟣 CLIPS      (Purple)   - Clip extraction in progress
🟡 VALIDATION (Yellow)   - Soundsmith assessment
🟠 APPROVAL   (Orange)   - Venom + DARKSCO approval
🟢 RELEASED   (Green)    - Complete and ready
```

### Progress Bars
```
Design:     ▓░░░░░░░░░ 0-15%
Soundbank:  ▓▓▓▓▓░░░░░ 15-40%
Clips:      ▓▓▓▓▓▓░░░░ 40-60%
Validation: ▓▓▓▓▓▓▓░░░ 60-75%
Approval:   ▓▓▓▓▓▓▓▓░░ 75-90%
Release:    ▓▓▓▓▓▓▓▓▓░ 90-100%
```

---

## 🔄 Complete Workflow Example

**User Journey:**

1. **Creates Project**
   - Opens `/music`
   - Fills Sound Design Brief form
   - Creates profile with style, instrumentation, mood
   - → Database: sound_design_profiles created
   - → Hub shows: "design" status

2. **Creates Soundbank**
   - Creates soundbank with name
   - Uploads 7 stems (bass, pad, drums, FX, etc.)
   - → Database: soundbanks + stems created
   - → Hub shows: "soundbank" status, 7 stems

3. **Extracts Clips**
   - Extracts 24 playable clips from stems
   - → Database: clips + clip_versions created
   - → Hub shows: "clips" status, 24 clips

4. **Validates with Soundsmith**
   - Clicks "Run Soundsmith validation"
   - Soundsmith assesses coherence (4 dimensions)
   - → Database: production_feedback stored
   - → Hub shows: "validation" status, 82/100 score

5. **Scores with Venom**
   - Venom scores quality (100-point scale)
   - Assessment: Identity, Mix, Arrangement, Emotion, etc.
   - → Database: production_feedback stored
   - → Hub shows: "approval" status, 78/100 score

6. **DARKSCO Release**
   - Sends to DARKSCO 7-agent pipeline
   - All agents review and approve
   - → Database: soundbank_releases linked
   - → Hub shows: "released" status ✓

---

## 🎨 UI Components

### Hub Dashboard (`/music-hub`)
- **Stats Overview**: 4 key metric cards
- **Project Grid**: All projects with full details
- **Workflow Guide**: 6-phase visual guide
- **Navigation**: Sticky header with 4 main links

### Project Detail (`/music-hub/project/[id]`)
- **Header**: Project info, buttons
- **Timeline**: 6 phases with details
- **Quick Actions**: Edit, DARKSCO, Hub links

### Create Project (`/music`)
- **Stage 1**: Sound Design Brief form
- **Stage 2**: Soundbank + Stems upload
- **Stage 3**: Workflow Status display

---

## 📱 Navigation

### Sticky Header Links
```
┌─────────────────────────────────────────┐
│ [🎵 Hub] [➕ Create] [🔄 Workflows] [📊 Pipeline] │
└─────────────────────────────────────────┘
```

### Navigation Flow
```
/music-hub (Hub)
  ↓ click project
  /music-hub/project/[id] (Detail)
    ↓ edit
    /music (Edit)
    ↓ return
    /music-hub (Hub)

/music-hub (Hub)
  ↓ nav: Create
  /music (New)

/music-hub (Hub)
  ↓ nav: Workflows
  /darksco/workflows (DARKSCO)

/music-hub (Hub)
  ↓ nav: Pipeline
  /darksco/pipeline (Architecture)
```

---

## 🔧 Orchestrator API

### MusicProductionOrchestrator Class

**Methods:**
```typescript
// Get complete project dashboard
async getProjectDashboard(projectId: string): ProjectDashboard

// Build comprehensive project view
private async buildMusicProject(profile, soundbanks): MusicProject

// Calculate intelligent next actions
private getProjectNextSteps(...): ProjectAction[]

// Get overall statistics
private async getProjectStats(projectId: string): Stats

// Get next milestone
private async getNextMilestone(projectId: string): Milestone | null

// Quick phase transitions
async transitionPhase(soundbankId, toPhase): {success, nextPhase}
```

---

## 📝 Database Schema

### Tables Used
- `sound_design_profiles` - Project profiles
- `soundbanks` - Versioned collections
- `stems` - Audio files
- `clips` - Extracted segments
- `clip_versions` - Version history
- `production_feedback` - Agent decisions
- `soundbank_releases` - DARKSCO linking
- `darksco_workflows` - Approval pipeline

---

## 🎯 Key Features

✅ **Auto Phase Detection** - Detects phase from database state  
✅ **Smart Next Actions** - Recommends next step per phase  
✅ **Blocker Detection** - Highlights issues automatically  
✅ **Progress Tracking** - Visual progress bars  
✅ **Quality Metrics** - Soundsmith + Venom scores  
✅ **Timeline Visibility** - All phase dates displayed  
✅ **Real-Time Updates** - Dashboard reflects current status  
✅ **DARKSCO Integration** - Seamless workflow connection  
✅ **Unified Navigation** - Single nav across all areas  
✅ **Production Ready** - Zero errors, 72 pages  

---

## 🚨 Common Actions

### View All Projects
```
Visit: /music-hub
See: Projects overview with status and metrics
```

### Check Project Status
```
Visit: /music-hub/project/[id]
See: Complete timeline with all phase details
```

### Create New Project
```
Visit: /music
Follow: 3-stage workflow (Design → Soundbank → Status)
```

### Move to Next Phase
```
1. Ensure current phase complete
2. Check for blockers
3. Click "Next Action" in hub
4. Phase auto-progresses in database
5. Hub updates immediately
```

### Review Agent Feedback
```
Visit: /music-hub/project/[id]
See: Soundsmith score + Venom score + blockers
Fix: Issues identified by agents
```

---

## 📞 Support

**For issues:**
1. Check `/music-hub` for project status
2. Review project detail page for phase and blockers
3. Check DARKSCO `/darksco/workflows` for approval status
4. Review production_feedback table for agent decisions
5. Check logs for API errors

**All workflows logged** with timestamps and decision details for complete audit trail.

---

**Version**: July 27, 2026 v1.0  
**Status**: Production Ready ✅  
**Build**: Zero errors, 72 pages generated

