# AI Garage Band V2 Design

**Date:** 2026-03-02
**Project:** `garage-band-demo`
**Design Goal:** Replace the current MVP shell with a state-machine driven, user-guided collaborative jam experience that is readable, reliable, and scoreable.

## Product Direction

This is an open collaborative jam with score, not a fail-state rhythm game. The experience should feel performative and social while still rewarding disciplined rhythm and consistency.

### Core outcomes
- Instrument interaction must be obvious without precise movement.
- Users should always know what to do next in each mode.
- A single run should feel like a complete arc: setup -> perform -> results.
- Scoring must reflect consistency/rhythm first.

## Selected Approach

**Chosen:** Full gameplay state-machine refactor first (Option 2).

Why:
- Current app has core technical pieces but weak flow coherence.
- A mode-driven architecture reduces UX ambiguity and regression risk.
- Polish and creative layers become straightforward once transitions and rules are explicit.

## Game Definition (V2)

### Run format
- Timer-based jam session.
- User chooses `60s` or `90s` in setup.
- Instruments are chosen per lane in setup and locked when jam starts.

### Modes
1. `setup`
- Lane instrument selection
- BPM/quantization controls
- timer length selection
- start session action

2. `calibration`
- Guided raise-hands capture
- Per-lane occupancy feedback
- lock confirmation before progression

3. `tutorial`
- Short gesture tutorial (8 beats)
- Lane-by-lane trigger confirmation
- clear “ready” handoff to jam mode

4. `jam`
- Fixed timer countdown
- live score + combo + lane feedback
- on-beat grading cues

5. `results`
- final score breakdown
- longest combo
- timing/consistency grade
- local high-score comparison

## Instrument Model (Low-Precision Controls)

### Default easy instrument set
- Left lane: `Rhythm`
- Middle lane: `Bass`
- Right lane: `Pad/Chords`

### Gesture definitions
- Rhythm:
  - Broad downward wrist velocity triggers percussion events.
  - Debounce/cooldown avoids jitter spam.

- Bass:
  - One forgiving trigger gesture (pluck burst).
  - Pitch selected using 3 broad arm-angle buckets.
  - Notes constrained to chord tones.

- Pad/Chords:
  - Hold posture engages sustained chord layer.
  - Torso/hand height modulates filter and volume with smoothing.

## Scoring Rules (V1)

Scoring prioritizes rhythm and consistency:

- `Timing Score` (highest weight)
  - Event timing quality against quantized beat grid.
  - Perfect/on-time windows award most points.

- `Consistency Score`
  - Rewards steady lane activity across the whole run.
  - Penalizes long idle gaps.

- `Stability Bonus`
  - Rewards accepted intent signals vs rejected jitter attempts.

- `Combo Multiplier`
  - Increases with consecutive on-time actions.
  - Decays on misses and inactivity.

No failure state in v1; this is performance scoring only.

## UX and Visual Direction

### Structural UX
- Replace always-on controls panel with mode-specific screens.
- Each screen has one clear primary action.
- Persist “what to do now” copy near the camera feed.

### Jam feedback
- Per-lane instrument card with icon and gesture hint.
- Real-time lane confidence/activity meters.
- Hit feedback labels: `On Beat`, `Late`, `Great Hit`.
- Strong beat pulse and combo animation.

### Results feedback
- Score breakdown with immediate rationale.
- Local best comparison and replay CTA.

## Architecture Changes

### State architecture
Introduce a central game mode machine plus explicit transition guards.

Proposed slices:
- `gameSessionSlice`
  - mode, timer, score, combo, run metrics, high score
- `laneConfigSlice`
  - lane instrument selection, locked state
- `poseRuntimeSlice`
  - occupancy, features, calibration state
- `audioRuntimeSlice`
  - transport state, schedule delay metrics

### Transition rules
- `setup -> calibration`: only after instrument/timer selection complete.
- `calibration -> tutorial`: only when lanes have lock confidence.
- `tutorial -> jam`: only after tutorial beat cycle completes.
- `jam -> results`: timer expiration or explicit end.

## Testing Strategy

### Unit tests
- Mode transition guards and timers.
- Scoring windows and combo behavior.
- Lane instrument mapping behavior.

### Integration tests
- End-to-end mode flow from setup to results.
- Lock-at-start behavior for instruments.
- Jam timer completion and score finalization.

### Browser validation
- Playwright interaction loops for setup/calibration/tutorial/jam/results.
- Screenshot checks for UI clarity and lane feedback.

## Optional AI Extensions (Post-Core)

Only after core flow is stable:
- TTS announcer for countdown and results narration.
- AI-generated band/performance title.
- Optional post-jam hype audio sting.
- Optional API-driven style presets (while preserving local fallback).

Core jam functionality must remain fully operational without external API calls.

## Non-Goals for this refactor
- Multiplayer networking.
- Cloud persistence of scores.
- Procedural composition beyond deterministic conductor constraints.

## Acceptance Criteria for V2 Refactor
- Users can complete a full 60s/90s run through all modes without confusion.
- Instrument gestures are visually taught and reliably trigger with broad movements.
- Score reflects rhythm/consistency and is visibly explained on results screen.
- UI presents clear, polished lane-level feedback during jam.
- Tests cover mode flow and scoring behavior with passing CI-local checks.
