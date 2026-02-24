# AI Garage Band MVP Design

**Date:** 2026-02-24  
**Project:** `garage-band-demo`

## Goals
- Local-first browser demo (Chrome/Edge) with one webcam and one machine.
- 2-3 participants in a single frame mapped to Left/Middle/Right instrument zones.
- Multi-person movement drives real-time music that stays in time and in key.
- Optimize for movement-to-audio cue responsiveness with target end-to-end latency <=120ms.

## Scope (MVP)
- Vite + React + TypeScript app.
- TensorFlow.js MoveNet MultiPose on client.
- Tone.js audio engine with deterministic conductor rules (no LLM calls).
- Zone-based assignment (not identity IDs) with hysteresis and auto-reacquire after ~2s missing.
- Controls for start/stop, BPM, quantization, skeleton, conductor, calibration.
- Diagnostics for FPS, inference timing, chord state, per-zone energy, person count.

## Architecture
### Selected approach
- Start with main-thread inference + rendering + scheduling for fastest delivery.
- Design modules so pose inference can move to a Worker if measured latency/stability misses target.

### Main modules
- `src/components/CameraView.tsx`: webcam capture and video element lifecycle.
- `src/components/OverlayCanvas.tsx`: optional skeleton/zones/beat indicators.
- `src/components/Controls.tsx`: runtime controls and calibration trigger.
- `src/components/Diagnostics.tsx`: performance/music diagnostics panel.
- `src/pose/movenet.ts`: backend/model loading and multipose inference.
- `src/pose/zoning.ts`: 3-zone selection with hysteresis and missing-target reacquire.
- `src/pose/features.ts`: wrist velocity, torso Y, arm angle, rolling energy.
- `src/music/transport.ts`: Tone transport setup + quantization boundary helpers.
- `src/music/instruments.ts`: drum/bass/pad instrument definitions.
- `src/music/conductor.ts`: key/chord constraints + fill/idle support rules.
- `src/music/mapping.ts`: feature-to-musical-intent mapping.
- `src/state/store.ts`: Zustand store for shared realtime state.

## Data flow
1. Capture frame from webcam.
2. Run pose inference on configured cadence (targeting 30Hz when feasible; degrade safely).
3. Assign zone occupants from current poses using zone confidence + hysteresis.
4. Extract per-zone motion features and rolling energy metrics.
5. Update store and diagnostics.
6. Emit musical intents to quantizer.
7. Quantizer schedules on next grid boundary (`1/8` default) through `Tone.Transport`.
8. Conductor validates events against current chord/key and applies deterministic support/fill rules.
9. Instruments render audio in real time.

## Latency and performance strategy
- Primary quality metric: movement-to-audio cue <=120ms.
- Visual updates remain immediate; audio uses short lookahead quantized scheduling (50-120ms).
- Keep overlays lightweight and optional to prioritize inference + audio timing.
- Instrument runtime metrics to expose inference ms, loop cadence, and event scheduling delay.
- Fallback plan if target missed:
  1. Reduce overlay/detail and inference workload.
  2. Move inference to Worker with unchanged app-facing APIs.

## Calibration and zoning behavior
- Calibration flow: “Stand in your zone, raise both hands” for 2 seconds.
- Lock nearest qualifying pose per zone on calibration completion.
- If zone occupant disappears for >2s, auto-reacquire nearest valid pose in that zone.
- Use hysteresis (multi-frame confidence margin) before switching occupants to avoid jitter/swap churn.

## Music constraints (Conductor)
- Defaults: BPM 110, key A minor, progression loop Am-F-C-G.
- Quantization defaults to 1/8 notes, configurable to 1/4 and 1/16.
- Notes constrained to scale/chord tones.
- Global energy rise triggers tasteful short fills/filter opening.
- Idle zone gets minimal supportive pattern without overpowering active players.

## Risks and mitigations
- Pose throughput variability on lower hardware:
  - expose inference/canvas knobs and diagnostics,
  - degrade gracefully before audio quality.
- Camera/lighting occlusion causing unstable detections:
  - zone hysteresis + calibration + README demo guidance.
- Browser audio startup restrictions:
  - explicit user gesture start and troubleshooting notes.

## Acceptance alignment
- Localhost-only, no paid/external APIs.
- Supports at least 2 people in frame.
- Musical output stays in time/key under chaotic movement.
- Reasonable CPU with tunable inference cadence.
