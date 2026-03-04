# Jam Hero Section Cues Design

## Goal
Improve Jam Hero readability and scoring by making planned section flow explicit. Players should understand when to play, when to wait, and who is about to solo without bringing back a cluttered timeline UI.

## Problem
The current arrangement system already rotates through harmony, solo, and blend sections, but the UI mainly exposes the current section through a small top-level callout and lane dimming. That is not enough for 2-3 players sharing one frame. Players need advance notice, and the game needs to score against section participation, not just timing.

## Current State
Relevant files:
- `src/game/arrangement.ts`
- `src/App.tsx`
- `src/components/screens/JamScreen.tsx`
- `src/components/jam/TopHUD.tsx`
- `src/components/jam/LaneCard.tsx`
- `src/game/scoring.ts`

Current behavior:
- arrangement cycles through `harmony -> solo -> blend`
- solo focus rotates by lane
- jam UI shows the current section label
- lane cards dim when the lane is not currently active
- scoring is timing-based and does not penalize wrong-section participation

## Design Principles
- Keep the screen legible from a distance.
- Prefer anticipation over reaction: players need a short preview of what is coming next.
- Do not reintroduce a full timeline track.
- Penalize intentional wrong participation, not tracker noise.
- Preserve the backing groove as the only timing bed.

## Proposed UX
### 1. Global Section Banner
Add a compact stage-level section banner that clearly shows the current arrangement state:
- `HARMONY`
- `LEFT SOLO`
- `MIDDLE SOLO`
- `RIGHT SOLO`
- `BLEND`

This should sit near the top-center of the jam stage, distinct from the score HUD but not visually heavy.

### 2. Next Section Preview
Add a smaller companion chip that appears before transitions:
- `Next: Middle Solo`
- `Next: Blend`
- `Next: Harmony`

This preview should appear roughly one bar before the change, so players can prepare without a loud visual interruption.

### 3. Lane Role States
Each lane should show a role state derived from the arrangement, independent from the fine-grained gesture status.

Primary role states:
- `PLAY`
- `WAIT`
- `UP NEXT`

Secondary state remains the instrument-specific gesture readiness system already in place:
- `NO PLAYER`
- `GET READY`
- `HOLD`
- `HIT`
- `SUSTAIN`

The lane card should prioritize the role state visually and demote the gesture state to supporting information.

### 4. Solo Window Guidance
During solo sections:
- the solo lane should be visually emphasized
- non-solo lanes should remain visible but clearly in `WAIT`
- one bar before the solo changes, the next solo lane should show `UP NEXT`

This preserves stage awareness without forcing users to read a track map.

## Arrangement Model Changes
Extend `LoopArrangement` in `src/game/arrangement.ts` with:
- `nextSection`
- `nextFocusZone`
- `beatsUntilTransition`
- `roleStates: Record<ZoneId, 'play' | 'wait' | 'up_next'>`

Rules:
- `harmony` and `blend` sections: all lanes `play`
- `solo` section: focused lane `play`, others `wait`
- preview window: the next lane entering focus becomes `up_next` during the final bar before transition

## Scoring Changes
Add `section compliance` as a second gate on top of existing timing scoring.

### Allowed behavior
- If a lane is in `PLAY`, valid trigger attempts score normally.
- If a lane is in `UP NEXT`, no penalty yet.
- If a lane is in `WAIT`, a valid trigger attempt should:
  - break combo
  - apply a small penalty
  - trigger a short off-tone cue

### Important fairness rule
Only penalize valid player trigger attempts after occupancy and gesture intent have been confirmed. Do not penalize:
- empty lanes
- low-confidence tracking noise
- ambient movement without a recognized trigger

## Penalty Sound
Add a short off-tone feedback sound inspired by missed cue feedback in music games.

Requirements:
- brief and subtle
- low enough in the mix to avoid polluting the groove
- cooldown protected to avoid rapid spam

First-pass design:
- short muted synth or plucked dissonant stab
- one hit per lane every ~400-600ms maximum

## Phone Controllers Question
If players later connect phones as controllers, that would improve mechanics substantially for:
- timing precision
- note selection
- explicit trigger intent

Recommended future architecture if that happens:
- camera remains responsible for zoning, calibration, and stage presence
- phone input becomes the authoritative jam trigger layer

That is a later upgrade, not required for the next pass.

## Recommendation
Implement a section-cue system before any model/backend upgrade. This will improve gameplay quality more than switching to WebGPU right now because the current main gap is anticipation and section obedience, not raw pose throughput.
