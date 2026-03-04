# Jam Hero Gameplay Stabilization Design

**Date:** 2026-03-04

**Goal:** Stabilize `Jam Hero` so the game is readable and reliable before adding track selection: no skeleton during gameplay, no false triggers from empty lanes, calmer lane feedback, and explicit live posture states that tell players whether they are actually ready to play.

## Summary

The current `Jam Hero` build should not expand to multiple tracks yet. The main branch still runs as a single-track experience, and the underlying gameplay loop is not stable enough to support additional content cleanly.

This pass should focus on four outcomes:

- keep the experience on one track for now
- remove the skeleton overlay once calibration is complete
- prevent empty or stale lanes from producing sounds, score, or cue flashes
- replace beat-window flicker with stable player-state feedback

The product goal is not just fewer false triggers. The player must be able to tell, at a glance, whether a zone is empty, whether they are in the correct posture, and when a valid play event actually happened.

## Root-Cause Findings

These issues are rooted in the current implementation, not just in presentation.

### No Track Selection Exists On `main`

`Jam Hero` is still effectively a single-track experience.

Evidence:

- `src/components/screens/SetupScreen.tsx` only exposes lane instrument selection and jam duration.
- `src/state/store.ts` on `main` does not carry a `currentTrackId` or track preset selection flow.
- `src/App.tsx` on `main` renders the original single-track gameplay path.

Because track selection is not actually implemented on `main`, players are still hearing the original baseline behavior.

### Cue Flashing Is Caused By Global Beat-Window UI Logic

The current cue boxes are not tied to player readiness or posture.

Evidence:

- `src/components/jam/LaneCard.tsx` derives its label from only `lanePlayable` and `strikeWindowActive`.
- This means cards oscillate between `PLAY` and `HIT` every cue window, regardless of whether a player is present, armed, or correctly positioned.

This is why the cue boxes feel noisy and hard to interpret.

### False Sounds Come From Residual Energy And Low Trigger Thresholds

The game still treats small movement energy as musical intent.

Evidence:

- `src/pose/features.ts` decays previous `energy` even when `zonePoses[zone]` is `null`.
- `src/music/mapping.ts` fires `bass` when `feature.energy > 0.04` and the cooldown expires.
- `src/music/mapping.ts` fires `pad` when `feature.energy > 0.03` and the cooldown expires.

This allows stale movement, inference jitter, and low-level residual motion to generate events even when a section is effectively empty.

### The Player Has No Live “In Position” State

The current UI exposes static hints, but not live posture state.

Evidence:

- `src/components/jam/LaneCard.tsx` only shows `PLAY`, `HIT`, or `WAIT`.
- `src/components/screens/TutorialScreen.tsx` gives descriptive text, but the jam screen does not tell the player whether the system currently sees them as ready, holding, sustaining, or missing.

This makes it hard for players to correct themselves during play.

## Product Direction

The next gameplay pass should be a stabilization pass, not a content pass.

Do now:

- stabilize one track
- clarify lane states
- hard-gate occupancy
- hide skeleton after calibration

Do later:

- add track selection
- add more presets
- tune genre-specific motion mappings across multiple tracks

The sequencing matters. Adding track selection before stabilizing mechanics multiplies the tuning surface across broken input logic.

## Runtime Design

### Occupancy Gating

Each lane should have an explicit occupancy state derived from zoning.

Rules:

- a lane is `occupied` only when a valid pose is assigned to that zone
- occupancy should not clear instantly; use a short release window around `200-300ms`
- if a lane is unoccupied:
  - no player-triggered notes
  - no score events
  - no hit flashes
  - no active cue label
  - activity meter decays to zero quickly

This removes the current stale-energy problem at the top of the decision tree.

### Gesture Intent States

The jam UI should stop using beat-window state as the primary status signal. Instead, each lane should render a stable intent state:

- `NO PLAYER`
- `GET READY`
- `HOLD`
- `HIT`
- `SUSTAIN`

These states should be driven by validated occupancy plus instrument-specific rules.

### Instrument Rules

#### Drums

Use a hit-based interaction.

Rules:

- occupied lane with visible hands -> `GET READY`
- clear downward strike above threshold -> `HIT`
- short cooldown / recover period after a successful hit
- no drum hit from background sway alone

#### Bass

Use a hold-plus-pulse interaction.

Rules:

- occupied lane without stable note posture -> `GET READY`
- stable arm angle in a note slot for minimum time -> `HOLD`
- pulse after a valid hold -> `HIT`
- no bass note from raw energy alone

#### Keys

Use a hold-and-sustain interaction.

Rules:

- occupied lane with incomplete posture -> `GET READY`
- both hands raised/open and approaching hold threshold -> `HOLD`
- hold threshold passed -> `SUSTAIN`
- release posture -> return to `GET READY` or `NO PLAYER`

## Visual / UX Changes

### Skeleton Visibility

The full skeleton overlay should appear only during `calibration`.

Behavior:

- `calibration`: skeleton visible
- `tutorial`: skeleton hidden
- `jam`: skeleton hidden
- zone backgrounds, lane activity, beat accents, and hit flashes remain available

This keeps calibration precise without cluttering gameplay.

### Lane Cards

Lane cards should become stateful and calmer.

Display rules:

- `NO PLAYER`: dimmed card, subdued label
- `GET READY`: stable neutral label
- `HOLD`: stronger visual cue indicating posture alignment
- `HIT`: short pulse only when a real trigger happens
- `SUSTAIN`: continuous glow for held keys state

The critical change is that `HIT` becomes event-driven, not beat-window-driven.

### Instruction Copy

Each lane keeps one concise live hint tied to the instrument:

- drums: `Strike downward`
- bass: `Hold note pose, then pulse`
- keys: `Raise both hands and hold`

The hint should remain readable, but the state label should carry the real meaning.

## Scoring And Audio Rules

Scoring should only evaluate valid player attempts.

Rules:

- if a lane is unoccupied, ignore score attempts entirely
- if posture is invalid, do not emit player notes
- hit grade popups should only appear for valid trigger attempts
- background timing or arrangement cues may continue visually, but lane-level success feedback must remain local to real player events

This keeps the score aligned with actual play instead of noise.

## Architecture Changes

Add a thin gameplay-state layer between raw pose features and UI/audio outputs.

Recommended state shape per lane:

- occupancy flag
- occupancy hold timer / last-seen timestamp
- gesture intent phase
- optional armed posture metadata
- last confirmed trigger timestamp

This layer should drive:

- lane UI labels
- whether mapping is allowed to emit events
- whether score feedback is allowed to fire

The existing arrangement system can remain, but it must not override occupancy truth.

## Testing Strategy

Add automated coverage for:

- empty lane produces no bass/pad/drum events
- occupancy release delay prevents flicker on brief inference drops
- lane card labels map correctly to gameplay states
- skeleton is visible in calibration and absent in tutorial/jam
- score feedback does not fire for unoccupied zones

Browser verification should confirm:

- calibration still shows skeleton
- jam no longer shows skeleton
- empty zones remain quiet and visually subdued
- deliberate gestures move lanes through `GET READY`, `HOLD`, `HIT`, and `SUSTAIN` as appropriate

## Risks

- if occupancy release is too short, zones will flicker
- if occupancy release is too long, empty lanes will feel sluggish to clear
- over-tight posture thresholds can make the game feel unresponsive
- under-tight thresholds will reintroduce false triggers under a different label

The right tradeoff is readable and forgiving, not maximally sensitive.
