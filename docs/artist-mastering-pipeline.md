# DARKSCO Artist → Mastering Pipeline

Status: **ACTIVE SPECIFICATION**  
Executive producer and final decision owner: **Irina**

## Decision hierarchy

Irina is the final human authority for production direction and release decisions.

Her operating style is:

- direct,
- demanding,
- decisive,
- quality-first,
- intolerant of generic or weak work.

Novorossiysk is biographical context only. The system must not derive behavior from nationality, gender, or birthplace.

Domain agents recommend and execute. They do not replace Irina's final judgement.

## Pipeline

```text
APPROVED BRIEF
    ↓
DARKSCO ARTIST
composition → sound design → arrangement → mix production → stems
    ↓
ARTIST VALIDATION GATE
manifest → checksums → reconstruction → rights → Irina production approval
    ↓
DARKSCO MASTERING
intake QC → mastering → format renders → translation QC
    ↓
MASTERING VALIDATION GATE
measurements → checksums → playback QC → metadata
    ↓
IRINA FINAL QC
GO / REVISE / DELAY / REJECT
```

## Agent 1 — DARKSCO Artist

Owns:

- musical interpretation of the approved brief,
- composition and original musical content,
- sound design,
- transitions and microvariation,
- Arrangement View production,
- production mix,
- stem and premaster export,
- source, sample, contributor, and AI-assistance records.

The Artist outputs:

```text
artist-package/<project-id>/<version>/
├── stems/
├── premaster/
├── artist-manifest.json
├── artist-report.md
└── rights/
```

Required status before handoff:

```text
READY_FOR_MASTERING
```

The Artist cannot declare a master final and cannot approve public release.

## Artist package gate

The package advances only when:

- all files share the intended sample rate, bit depth, and timeline,
- every stem has a SHA-256 checksum,
- no silent placeholder stem exists,
- stems reconstruct the approved premaster within documented tolerance,
- the premaster is unclipped and has adequate headroom,
- arrangement and transitions are complete,
- rights status is `cleared`,
- Irina has approved the production direction.

Failure returns:

```text
REVISE_ARTIST
```

## Agent 2 — DARKSCO Mastering

Owns:

- intake integrity checks,
- premaster and stem reconstruction verification,
- tonal and dynamic translation,
- transparent stem mastering when necessary,
- archive, release, and approved alternate masters,
- true-peak, loudness, phase, mono, playback, and format QC,
- final technical report and checksums.

The Mastering Agent outputs:

```text
master-package/<project-id>/<version>/
├── masters/
├── mastering-manifest.json
└── mastering-report.md
```

Required status before final review:

```text
READY_FOR_IRINA_QC
```

The Mastering Agent must reject rather than conceal:

- clipping or damaged exports,
- missing or misaligned stems,
- arrangement defects,
- uncontrolled low end requiring remixing,
- harshness that cannot be corrected transparently,
- unclear rights,
- a premaster that differs materially from the stem reconstruction.

Failure returns:

```text
REJECT_TO_ARTIST
```

with a bounded defect list.

## Irina final gate

Irina chooses one outcome:

- `GO` — approve release and freeze the master package.
- `REVISE` — send a bounded revision request to Artist or Mastering.
- `DELAY` — preserve current versions while blocking release.
- `REJECT` — terminate the candidate and retain evidence for learning.

Every decision requires a written reason.

## Version and preservation rules

- Never overwrite an approved or reviewed package.
- Increment Artist package versions independently from master versions.
- Preserve all manifests and checksums.
- A Mastering rejection must reference exact input files and defects.
- An Artist revision must preserve the rejected package and generate a new manifest.
- Only Irina can authorize `GO`.

## Automation boundary

The pipeline may automate planning, composition assistance, rendering, validation, file transfer, mastering processing, and reporting.

It must not automate away:

- rights clearance,
- source truth,
- defect disclosure,
- Irina's production approval,
- Irina's final release decision.

## Implementation

Repository validator:

```text
darksco/production_pipeline.py
```

Tests:

```text
tests/test_production_pipeline.py
```

Skill bundles:

- `darksco-artist`
- `darksco-mastering`
