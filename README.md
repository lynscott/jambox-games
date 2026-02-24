# AI Garage Band (MVP)

Local web demo where 2-3 people in one webcam frame are assigned virtual instruments and movement drives in-key, quantized music in real time.

## Tech Stack

- Vite + React + TypeScript
- TensorFlow.js MoveNet MultiPose (`@tensorflow-models/pose-detection`)
- Tone.js for browser audio synthesis
- Zustand for realtime state
- Vitest + Testing Library for tests

## Features Implemented

- Webcam capture and overlay canvas pipeline
- MoveNet multipose inference loop (targeting ~30Hz cadence)
- Zone assignment (Left/Middle/Right) with hysteresis and missing-person reacquire
- Calibration flow: raise both hands for ~2 seconds to lock zone anchors
- Motion feature extraction per zone:
  - wrist velocity
  - torso/hip center Y
  - shoulder-to-wrist angle
  - rolling energy metric
- Music engine:
  - transport + quantization helpers
  - drum/bass/pad synth instruments
  - deterministic conductor (A minor, Am-F-C-G progression)
  - feature-to-event mapping with debounce and idle support
- UI controls:
  - Start/Stop
  - BPM (80-140)
  - Quantization (1/4, 1/8, 1/16)
  - Skeleton overlay toggle
  - AI Conductor toggle
  - Calibration trigger
- Diagnostics panel:
  - FPS
  - inference time
  - current chord
  - person count
  - per-zone energy
  - movement-to-audio scheduling delay

## Project Structure

```text
src/
  components/
    CameraView.tsx
    Controls.tsx
    Diagnostics.tsx
    OverlayCanvas.tsx
  music/
    conductor.ts
    instruments.ts
    mapping.ts
    transport.ts
  pose/
    features.ts
    movenet.ts
    zoning.ts
  state/
    store.ts
  App.tsx
```

## Setup

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

## Demo Flow

1. Click `Start`.
2. Allow camera permission.
3. If audio is blocked, click `Start` again after interacting with the page.
4. Stand participants in left/middle/right regions.
5. Click `Calibrate`, raise both hands for ~2 seconds.
6. Move arms/body to trigger drum/bass/pad events.

## Recommended Demo Environment

- Browser: latest Chrome or Edge
- Device: laptop with integrated webcam
- Participants: 2-3 people, shoulder-to-knee visible
- Distance: ~1.8-3 meters from webcam
- Camera height: chest-to-head level, centered
- Lighting: bright, front-lit, minimal backlight
- Background: uncluttered, avoid moving objects behind players

## Controls

- `Start/Stop`: starts webcam + audio transport
- `BPM`: 80-140
- `Quantization`: `1/4`, `1/8` (default), `1/16`
- `Skeleton`: show/hide pose skeleton overlay
- `AI Conductor`: keep deterministic assist layer on/off
- `Calibrate`: zone anchor lock using raised-hands gesture

## Troubleshooting

### Camera permission denied
- Reload the page and allow camera access.
- Check browser site permissions and OS camera privacy settings.

### WebGL backend fails
- The app attempts fallback from `webgl` to `wasm` and then `cpu`.
- Performance will drop on `wasm/cpu`; reduce motion complexity or participant count.

### No audio playback
- Browser audio requires user gesture. Click `Start` from a direct page interaction.
- Ensure system output device is active and not muted.

### Pose unstable / frequent dropouts
- Increase front lighting.
- Reduce occlusion (avoid people crossing directly in front of each other).
- Keep all participants fully in frame.

### High CPU or lag
- Use 2 participants instead of 3.
- Close other browser tabs/apps.
- Lower webcam resolution in browser/device settings if needed.

## Scripts

```bash
npm run dev
npm run test
npm run build
```

## Notes

- This MVP is local-only (no networking, no paid APIs, no external services).
- Conductor behavior is deterministic rule logic (no LLM calls).
