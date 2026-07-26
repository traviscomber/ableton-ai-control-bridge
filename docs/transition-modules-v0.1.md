# DARKSCO Transition Modules v0.1

Status: **ACTIVE SPECIFICATION**  
Source reference: `production/night-protocol-001/arrangement-v0.2.md`  
Owners: Venom and Ultron  
Orchestration: Darkside

## Purpose

Convert the Night Protocol 001 production lessons into reusable transition and variation rules that can later support Night, Noon, and Morning SongPlans.

This is a planning specification. It does not execute commands or modify Ableton projects.

## Shared variation cadence

- Every 4 bars: one detail-level change.
- Every 8 bars: one pattern-level change.
- Every 16 bars: one structural change.
- No 16-bar block should exactly duplicate the previous block.

## Night profile

Identity: controlled subterranean transformation.

### Reveal transition

Use for Detection into Alignment.

- Partially reveal the kick.
- Narrow the atmosphere.
- Leave a brief silence before the section change.
- Introduce kick and sub together.
- Delay the main percussion entry.

### Pressure transition

Use for Alignment into Pressure.

- Reduce bass activity before the change.
- Add one metallic detail.
- Increase atmosphere width gradually.
- Restore bass with a stronger variation.
- Make the motif clearer after the transition.

### Void transition

Use for Pressure into Void.

- Remove percussion in stages.
- Simplify the bass.
- Extend the motif.
- Preserve a short effect tail.
- Remove the kick.
- Continue reducing density after the transition.

### Activation transition

Use for Void into Activation.

- Introduce filtered sub pulses before the kick.
- Narrow the stereo field.
- Reduce high-frequency detail.
- Return kick and bass together.
- Restore width over two bars.
- Return percussion in stages.

### Descent transition

Use for Activation into Aftermath.

- Remove high detail first.
- Reduce bass variation.
- Narrow the motif register.
- Remove impacts and major textures.
- Reduce kick density.
- Retain one unresolved signal.

## Signature event template

Recommended duration: 16 bars.

- Narrow the mix.
- Remove detail percussion.
- Transform the texture.
- Omit the kick for one bar.
- Change motif register or timing.
- Restore full width.
- Return with the strongest groove variation.

## Night constraints

- Keep kick variation limited mainly to transition omissions.
- Preserve space between kick and bass.
- Limit motif changes to register, timing, filtering, note omission, and space.
- Avoid conventional festival-style breakdowns.
- Avoid stacking unrelated transition effects.
- Avoid uncontrolled saturation and excessive density.

## Noon adaptation

Identity: architectural momentum.

Required changes from the Night profile:

- Use fewer cinematic impacts.
- Increase rhythmic precision.
- Use cleaner spatial changes.
- Preserve continuous functional groove.
- Emphasize microvariation over dramatic interruption.

## Morning adaptation

Identity: organic awakening.

Required changes from the Night profile:

- Replace pressure with gradual expansion.
- Use harmonic and textural transitions.
- Reduce kick-centered events.
- Prioritize evolving space and organic detail.
- Use silence as openness rather than threat.

## Next implementation step

After Night Protocol 001 is heard and reviewed in Ableton:

1. Mark which transition rules worked.
2. Remove ineffective rules.
3. Encode the approved rules into the SongPlan schema.
4. Create distinct Noon and Morning reference modules.
5. Add validation that prevents exact 16-bar duplication.
