# AI Garage Band MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local, runnable web demo where 2-3 people in one webcam frame drive quantized, in-key music via zone-based motion tracking.

**Architecture:** Use a modular React + TypeScript frontend with a Zustand realtime store, MoveNet multipose inference, zone-stable assignment + feature extraction pipeline, and Tone.js transport/instrument stack constrained by a deterministic conductor. Prioritize movement-to-audio responsiveness (<=120ms target) with quantized scheduling and lightweight visuals.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Zustand, TensorFlow.js + MoveNet multipose, Tone.js, Canvas API.

---

### Task 1: Scaffold app and testing baseline

**Files:**
- Create: `package.json` (via Vite scaffold)
- Create: `src/*` (Vite baseline)
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` scripts/dependencies

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';

describe('baseline', () => {
  it('runs tests', () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/smoke/baseline.test.ts`
Expected: FAIL because test tooling is not configured yet.

**Step 3: Write minimal implementation**
- Scaffold Vite React TS app.
- Install runtime deps: `zustand`, `tone`, `@tensorflow/tfjs-core`, `@tensorflow/tfjs-backend-webgl`, `@tensorflow/tfjs-backend-wasm`, `@tensorflow-models/pose-detection`.
- Install dev deps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- Add `test` and `test:watch` scripts.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/smoke/baseline.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold vite app with test baseline"
```

### Task 2: Build state model and app shell controls

**Files:**
- Create: `src/state/store.ts`
- Create: `src/types.ts`
- Create: `src/components/Controls.tsx`
- Modify: `src/App.tsx`
- Test: `src/state/store.test.ts`
- Test: `src/components/Controls.test.tsx`

**Step 1: Write the failing test**
- Test default state values (BPM 110, quantization `8n`, conductor enabled).
- Test controls update store values.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/state/store.test.ts src/components/Controls.test.tsx`
Expected: FAIL because store/components do not exist.

**Step 3: Write minimal implementation**
- Add typed Zustand store for transport, toggles, diagnostics, zone snapshots.
- Add Controls component with Start/Stop, BPM (80-140), quantization dropdown, toggles, calibration trigger.
- Wire controls into App shell.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/state/store.test.ts src/components/Controls.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/state/store.ts src/types.ts src/components/Controls.tsx src/components/Controls.test.tsx src/state/store.test.ts src/App.tsx
git commit -m "feat: add state model and runtime controls"
```

### Task 3: Implement webcam capture and overlay canvas pipeline

**Files:**
- Create: `src/components/CameraView.tsx`
- Create: `src/components/OverlayCanvas.tsx`
- Test: `src/components/CameraView.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**
- CameraView requests webcam on start and stops tracks on stop/unmount.
- OverlayCanvas renders with expected dimensions when media stream active.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/CameraView.test.tsx`
Expected: FAIL due missing camera component behavior.

**Step 3: Write minimal implementation**
- Add webcam lifecycle abstraction with permission error handling.
- Render video element + transparent canvas overlay.
- Provide callbacks for frame and stream status.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/CameraView.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/CameraView.tsx src/components/OverlayCanvas.tsx src/components/CameraView.test.tsx src/App.tsx
git commit -m "feat: add webcam capture with overlay canvas"
```

### Task 4: Add pose model wrapper and zoning with hysteresis

**Files:**
- Create: `src/pose/movenet.ts`
- Create: `src/pose/zoning.ts`
- Test: `src/pose/zoning.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**
- Zone assignment picks highest-confidence pose per vertical zone.
- Hysteresis prevents frequent switching.
- Missing occupant for >2s triggers reacquire.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pose/zoning.test.ts`
Expected: FAIL because zoning logic does not exist.

**Step 3: Write minimal implementation**
- Add MoveNet loader/infer API with webgl->wasm fallback.
- Add zoning state machine with confidence margin, hold frames, and missing timeout.
- Integrate pose loop in App at configurable cadence.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/pose/zoning.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pose/movenet.ts src/pose/zoning.ts src/pose/zoning.test.ts src/App.tsx
git commit -m "feat: add multipose inference wrapper and stable zoning"
```

### Task 5: Add motion feature extraction and diagnostics UI

**Files:**
- Create: `src/pose/features.ts`
- Create: `src/components/Diagnostics.tsx`
- Test: `src/pose/features.test.ts`
- Test: `src/components/Diagnostics.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**
- Feature extraction computes wrist velocity, torso Y, shoulder-wrist angle, rolling energy.
- Diagnostics renders current FPS/inference/chord/energy/person count.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pose/features.test.ts src/components/Diagnostics.test.tsx`
Expected: FAIL due missing feature and diagnostics modules.

**Step 3: Write minimal implementation**
- Implement per-zone feature calculators with debounce-ready outputs.
- Push rolling metrics into store.
- Render diagnostics panel.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/pose/features.test.ts src/components/Diagnostics.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pose/features.ts src/pose/features.test.ts src/components/Diagnostics.tsx src/components/Diagnostics.test.tsx src/App.tsx
git commit -m "feat: add motion feature extraction and diagnostics"
```

### Task 6: Build transport, quantizer, instruments, and conductor

**Files:**
- Create: `src/music/transport.ts`
- Create: `src/music/instruments.ts`
- Create: `src/music/conductor.ts`
- Test: `src/music/transport.test.ts`
- Test: `src/music/conductor.test.ts`

**Step 1: Write the failing test**
- Quantizer schedules on next musical boundary for selected resolution.
- Conductor clamps notes to key/chord tones and advances Am-F-C-G loop.
- Idle-support and energy-fill rules are deterministic.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/transport.test.ts src/music/conductor.test.ts`
Expected: FAIL because music modules do not exist.

**Step 3: Write minimal implementation**
- Add Tone transport manager with bpm/update lifecycle.
- Add drum/bass/pad synth wrappers.
- Add conductor state + constraint helpers.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/transport.test.ts src/music/conductor.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/transport.ts src/music/instruments.ts src/music/conductor.ts src/music/transport.test.ts src/music/conductor.test.ts
git commit -m "feat: add transport, instruments, and conductor constraints"
```

### Task 7: Map features to quantized musical events + calibration flow

**Files:**
- Create: `src/music/mapping.ts`
- Test: `src/music/mapping.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**
- Wrist velocity above threshold maps to debounced drum intents.
- Arm angle maps bass notes through conductor constraints.
- Torso Y maps pad volume/filter.
- Idle zone emits minimal supportive intents.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/mapping.test.ts`
Expected: FAIL due missing mapping logic.

**Step 3: Write minimal implementation**
- Implement deterministic feature->intent mapping with debounce/thresholds.
- Add calibration state machine in app/store.
- Wire mapping output into transport quantizer + instruments.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/mapping.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/mapping.ts src/music/mapping.test.ts src/App.tsx src/state/store.ts
git commit -m "feat: map pose features to quantized musical intents with calibration flow"
```

### Task 8: Render skeleton/zones/beat indicators and finalize UX

**Files:**
- Modify: `src/components/OverlayCanvas.tsx`
- Test: `src/components/OverlayCanvas.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**
- Overlay respects skeleton toggle.
- Zone boundaries and beat indicators render.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/OverlayCanvas.test.tsx`
Expected: FAIL due missing render logic.

**Step 3: Write minimal implementation**
- Add canvas drawing for keypoints/skeleton, zone guides, beat pulse.
- Keep rendering lightweight and optional.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/OverlayCanvas.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/OverlayCanvas.tsx src/components/OverlayCanvas.test.tsx src/App.tsx
git commit -m "feat: add overlay visuals for skeleton zones and beat"
```

### Task 9: Documentation and verification

**Files:**
- Create: `README.md`
- Modify: `docs/plans/2026-02-24-ai-garage-band-implementation.md` (optional status notes)

**Step 1: Write the failing test**
- N/A (docs-only task).

**Step 2: Run verification commands**

Run:
- `npm run test`
- `npm run build`

Expected: all tests pass and production build succeeds.

**Step 3: Write minimal implementation**
- Document setup/run/demo steps, controls, diagnostics, and troubleshooting:
  - camera denied,
  - webgl backend fallback,
  - audio gesture requirement,
  - lighting/framing guidance.

**Step 4: Re-run verification**

Run:
- `npm run test`
- `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add setup and demo troubleshooting guide"
```
