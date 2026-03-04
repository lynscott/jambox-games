# Jam Hero Midnight Soul Design

**Date:** 2026-03-04

**Goal:** Redesign `Jam Hero` gameplay and sound around one polished jazz/soul preset so tempo is clear, the backing groove is musical, and player-controlled instruments only sound when deliberate gestures are detected.

## Summary

`Jam Hero` should move away from the current generic motion-to-sound mapper and toward a track-defined performance model. The first preset, `Midnight Soul`, will provide a continuous backing groove and a deterministic set of three player instruments:

- `Drums`
- `Bass`
- `Keys Pad`

The preset will define:

- groove and harmony
- BPM and feel
- visual/tutorial copy
- gesture rules per instrument

The backing groove should always provide tempo and vibe during the jam. Player sounds should layer on top only when the correct gesture or posture is present.

## Root-Cause Findings

The current random-audio problem is rooted in the mapping layer, not just the UI:

- `src/music/mapping.ts` currently emits `bass` notes whenever lane `energy > 0.04` and the lane cooldown expires.
- `src/music/mapping.ts` currently emits `pad` notes whenever lane `energy > 0.03` and the lane cooldown expires.
- `src/pose/features.ts` computes rolling `energy` from average keypoint movement, so idle sway, model jitter, and occupant drift can satisfy those thresholds.
- The guide beat currently provides only a simple hat pulse, which is enough for transport timing but weak as a musical cue.

This means the app is treating ambient movement as musical intent. Threshold tuning alone will not fix that reliably.

## Product Direction

The first pass should ship a single polished preset instead of a selector with multiple half-finished tracks. The code should still be structured so additional presets can be added later without rewriting the audio or gesture systems.

The design goal is:

- one clear groove
- one clear tutorial
- simple, readable gestures
- strong timing feedback
- no random player notes during idle movement

## Architecture

Use a `track preset + intent-gated gesture engine` architecture.

### Track Preset Layer

A track preset defines:

- `id`, `title`, `description`
- BPM, key, chord loop, and feel
- backing groove arrangement
- allowed lane instruments
- tutorial hints and gameplay copy
- gesture rules for each instrument

For `Midnight Soul`, the preset should set:

- mid-tempo soul/jazz feel, around `92-98 BPM`
- a mellow minor groove such as `A minor`
- warm keys, rounded bass, soft pocket drums
- `Drums`, `Bass`, and `Keys Pad` as the only allowed player instruments

### Backing Groove Layer

Replace the current minimal guide beat with a deterministic backing groove that runs during the jam and provides musical context.

The backing groove should include:

- drum pocket
- bass support line
- keys comp

The groove should be intentionally sparse enough that player-triggered sounds still read clearly.

### Gesture Intent Layer

Each lane gets a small gesture state machine rather than direct event emission from raw energy:

- `idle`
- `armed`
- `active`
- `cooldown`

This layer decides whether the player is intentionally trying to play.

### Player Trigger Layer

Once a gesture is validated, the resulting musical event is quantized and scheduled on the transport. Quantization stays in place, but only validated gesture events are allowed through.

## Instrument Interaction Model

### Drums

Interaction type: discrete hits.

Rules:

- trigger only on a clear wrist strike
- require wrist velocity above threshold
- require directional motion so a single jitter spike does not count
- apply cooldown so one swing cannot fire multiple hits

For the first pass, drum sound selection can stay simple and deterministic per lane or gesture band.

### Bass

Interaction type: hold-to-arm plus pulse-to-trigger.

Rules:

- player first holds a stable arm angle / posture long enough to arm a note slot
- that posture maps to one of a small number of chord-safe notes
- a short pulse or jab triggers the armed note
- idle sway must not trigger notes by itself

This creates an explicit two-step interaction and makes bass feel intentional.

### Keys Pad

Interaction type: sustain posture.

Rules:

- both hands raised above a relaxed threshold, or arms opened wide, arms the pad
- while the posture is held, the pad sustains
- dropping out of the posture releases the pad
- torso height modulates tone slowly, with smoothing and hysteresis

This should feel forgiving and readable rather than precise.

## Anti-Random Trigger Rules

The first pass should add the following behavior guards:

- minimum stable window before `armed`
- different enter and exit thresholds (hysteresis)
- per-instrument cooldowns
- direction checks for hit and pulse gestures
- smoothing on continuous controls such as pad filter
- scoring only on valid player trigger attempts

The key principle is: `movement magnitude is not intent`.

## UI / UX Changes

### Setup

The setup screen should introduce the active preset even if only one exists:

- show the `Midnight Soul` preset as the current track
- keep lane assignment locked to `Drums`, `Bass`, `Keys Pad` for the first pass, or limit the selector to those choices only
- show short track detail text so users understand the vibe before starting

### Tutorial

Tutorial hints should be rewritten around explicit gestures:

- `Drums`: `Hit with quick wrist strikes`
- `Bass`: `Hold a note pose, then pulse to play`
- `Keys Pad`: `Raise both hands to hold the chord`

### Jam Feedback

Each lane should show readable state feedback instead of only abstract energy:

- `Ready`
- `Hold`
- `Hit`
- `Sustain`
- optional `Cooldown`

This gives players immediate guidance on what the system expects.

### Diagnostics

Diagnostics should prioritize useful gameplay debugging:

- preset / track name
- gesture state per lane
- currently armed bass slot or pad active state
- movement-to-audio latency
- backing groove enabled state

Raw energy can remain, but it should no longer be the primary behavior signal.

## Sound Direction

The first preset should sound more like soul/jazz and less like default synth placeholders.

Recommended direction:

- drums: softer pocket kit / muted hat / rim-like snare behavior
- bass: rounded mono bass with shorter envelope
- keys pad: warm electric-piano / soft poly approximation with mellow filter

Tone.js remains the correct engine for this pass. No external audio provider is needed for low-latency live control.

## Extensibility

This design should leave room for later input systems such as a phone controller. The separation should be:

- pose features -> gesture intent
- controller input -> gesture intent
- gesture intent -> player trigger scheduling

That way a future phone controller can feed the same music layer without rewriting the track preset or backing groove engine.

## Testing Strategy

Add automated coverage for:

- track preset metadata and lane constraints
- per-instrument gesture state transitions
- backing groove scheduling logic
- idle movement not emitting bass or pad notes
- explicit drum hit, bass pulse, and pad sustain emitting predictable player events

Browser verification should confirm:

- backing groove starts and stops with the jam
- idle standing does not cause random notes
- tutorial hints match actual gesture rules
- gesture feedback and audio behavior stay aligned on screen

## Risks

- Renaming lane instruments from generic labels (`rhythm`, `pad`) to gameplay-specific labels (`drums`, `keys`) touches multiple screens and tests.
- Tone.js backing grooves can become muddy if the player layer duplicates the same register too densely.
- Gesture rules that are too strict will feel broken; too loose will reintroduce random triggering.
- Browser automation will not fully validate real human motion, so runtime diagnostics and manual testing remain important.
