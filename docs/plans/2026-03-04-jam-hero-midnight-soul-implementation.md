# Jam Hero Midnight Soul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Jam Hero's generic motion-to-audio mapper with a single polished `Midnight Soul` preset that provides a continuous backing groove and intent-gated `Drums`, `Bass`, and `Keys Pad` player controls.

**Architecture:** Introduce a track preset module, a gesture-intent state machine, and a backing groove scheduler. Keep Tone.js transport quantization, but stop emitting player events directly from low-level energy thresholds. Player events must flow through validated instrument-specific gesture states before scheduling and scoring.

**Tech Stack:** React, TypeScript, Zustand, Tone.js, Vitest, existing Vite app shell, existing Playwright web-game client

---

### Task 1: Add Track Preset Types And Tests

**Files:**
- Create: `src/music/tracks.ts`
- Create: `src/music/tracks.test.ts`
- Modify: `src/types.ts`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

Create `src/music/tracks.test.ts` with tests that assert:

- the app exposes a `Midnight Soul` preset
- the preset lane instruments are exactly `drums`, `bass`, and `keys`
- the preset defines BPM, key, chord loop, and tutorial hints
- the default app state points `Jam Hero` at `Midnight Soul`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/tracks.test.ts`
Expected: FAIL because the track preset module and new instrument labels do not exist.

**Step 3: Write minimal implementation**

Implement:

- `LaneInstrument` updates in `src/types.ts` from generic values to explicit values:
  - `drums`
  - `bass`
  - `keys`
- track preset types in `src/music/tracks.ts`
- a single exported `MIDNIGHT_SOUL_TRACK`
- minimal `state/store.ts` updates so the initial lane setup defaults to that preset's lane assignments

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/tracks.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/tracks.ts src/music/tracks.test.ts src/types.ts src/state/store.ts
git commit -m "feat: add midnight soul track preset"
```

### Task 2: Update Setup And Tutorial For The Preset

**Files:**
- Modify: `src/components/screens/SetupScreen.tsx`
- Modify: `src/components/screens/SetupScreen.test.tsx`
- Modify: `src/components/screens/TutorialScreen.tsx`
- Modify: `src/components/screens/TutorialScreen.test.tsx`
- Modify: `src/App.css`

**Step 1: Write the failing test**

Extend the setup and tutorial tests to assert:

- setup shows `Midnight Soul` title and short descriptor
- lane labels render `Drums`, `Bass`, and `Keys Pad`
- tutorial hints match the new gesture language:
  - drum strikes
  - bass hold plus pulse
  - keys hold to sustain

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/SetupScreen.test.tsx src/components/screens/TutorialScreen.test.tsx`
Expected: FAIL because the screens still use generic labels and hints.

**Step 3: Write minimal implementation**

Update setup and tutorial UI to read from the preset metadata instead of hard-coded generic text. Keep the layout intact. If instrument selection remains visible, constrain it to the preset-approved instruments and labels only.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/SetupScreen.test.tsx src/components/screens/TutorialScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/SetupScreen.tsx src/components/screens/SetupScreen.test.tsx src/components/screens/TutorialScreen.tsx src/components/screens/TutorialScreen.test.tsx src/App.css
git commit -m "feat: update setup and tutorial for midnight soul"
```

### Task 3: Add Gesture Intent State Machine Tests

**Files:**
- Create: `src/music/gesture-intent.ts`
- Create: `src/music/gesture-intent.test.ts`
- Modify: `src/types.ts`

**Step 1: Write the failing test**

Create `src/music/gesture-intent.test.ts` with tests that assert:

- `drums` enter `active` only after a clear strike threshold and cooldown is respected
- `bass` enters `armed` only after a stable posture window, and emits a trigger only on a pulse gesture
- `keys` enter `active` only after a valid open-hands posture, stay active while held, and release when posture ends
- idle noise does not produce player triggers for `bass` or `keys`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/gesture-intent.test.ts`
Expected: FAIL because the gesture intent engine does not exist.

**Step 3: Write minimal implementation**

Add a dedicated gesture-intent module that defines:

- per-lane gesture state
- per-instrument thresholds
- hysteresis
- stable-window tracking
- cooldown tracking
- explicit trigger outputs independent of music scheduling

Keep it data-first and deterministic.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/gesture-intent.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/gesture-intent.ts src/music/gesture-intent.test.ts src/types.ts
git commit -m "feat: add gesture intent state machine"
```

### Task 4: Expand Feature Extraction For Intent Detection

**Files:**
- Modify: `src/pose/features.ts`
- Modify: `src/pose/features.test.ts`
- Modify: `src/types.ts`

**Step 1: Write the failing test**

Extend `src/pose/features.test.ts` to assert the feature extractor returns enough data to drive intent rules, such as:

- wrist vertical direction or delta
- arm openness / both-hands-up signal
- stable note-selection angle for bass
- smoothed torso control for keys

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pose/features.test.ts`
Expected: FAIL because the feature snapshot does not include the additional posture signals.

**Step 3: Write minimal implementation**

Update `src/pose/features.ts` and related types to expose the smallest feature set needed by the gesture intent engine. Do not add speculative features that the first preset does not use.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/pose/features.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pose/features.ts src/pose/features.test.ts src/types.ts
git commit -m "feat: expand pose features for intent detection"
```

### Task 5: Replace Generic Mapping With Intent-Gated Player Events

**Files:**
- Modify: `src/music/mapping.ts`
- Modify: `src/music/mapping.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

Update `src/music/mapping.test.ts` to assert:

- idle `bass` and `keys` movement no longer emit notes
- a valid drum strike emits one drum event
- a valid bass armed posture plus pulse emits one bass event with a chord-safe note
- a valid keys hold posture emits a sustain-style pad event only while held

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/mapping.test.ts`
Expected: FAIL because mapping still emits directly from raw energy thresholds.

**Step 3: Write minimal implementation**

Refactor `src/music/mapping.ts` to consume the new gesture intent output instead of using `energy > threshold` shortcuts. Update `App.tsx` to keep the gesture state alongside mapping state and ensure scoring only processes valid player triggers.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/mapping.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/mapping.ts src/music/mapping.test.ts src/App.tsx src/state/store.ts
git commit -m "feat: gate player events through gesture intent"
```

### Task 6: Add Backing Groove Scheduler Tests

**Files:**
- Create: `src/music/backing-track.ts`
- Create: `src/music/backing-track.test.ts`
- Modify: `src/music/transport.ts`

**Step 1: Write the failing test**

Create `src/music/backing-track.test.ts` with tests that assert:

- `Midnight Soul` schedules a deterministic backing groove pattern
- the groove can start and stop cleanly
- the groove uses the track BPM and chord loop
- player-triggered notes are not generated by this module

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/backing-track.test.ts`
Expected: FAIL because the backing groove module does not exist.

**Step 3: Write minimal implementation**

Implement a backing-track scheduler module that uses the existing transport controller to register repeating drum/keys/bass support events for `Midnight Soul`. Keep it deterministic and separate from player-trigger generation.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/backing-track.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/backing-track.ts src/music/backing-track.test.ts src/music/transport.ts
git commit -m "feat: add midnight soul backing groove scheduler"
```

### Task 7: Warm Up Instrument Sounds For Soul/Jazz

**Files:**
- Modify: `src/music/instruments.ts`
- Modify: `src/App.tsx`
- Test: `src/music/backing-track.test.ts`

**Step 1: Write the failing test**

If needed, extend `src/music/backing-track.test.ts` or add focused assertions around instrument API usage to verify:

- backing groove uses the expected drum, bass, and keys trigger paths
- player layer still uses the same instrument API

Do not add snapshot tests for raw audio.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/backing-track.test.ts`
Expected: FAIL if the instrument API cannot support the new groove/pad behavior.

**Step 3: Write minimal implementation**

Retune `src/music/instruments.ts` toward:

- softer pocket drums
- rounded bass
- warmer keys/pad voicing

Only widen the API if the backing groove or player sustain model requires it.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/backing-track.test.ts src/music/mapping.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/instruments.ts src/App.tsx src/music/backing-track.test.ts src/music/mapping.test.ts
git commit -m "feat: retune midnight soul instrument patches"
```

### Task 8: Surface Gesture Feedback And Better Diagnostics

**Files:**
- Modify: `src/components/screens/JamScreen.tsx`
- Modify: `src/components/jam/LaneBar.tsx`
- Modify: `src/components/jam/LaneCard.tsx`
- Modify: `src/components/Diagnostics.tsx`
- Modify: `src/components/Diagnostics.test.tsx`
- Modify: `src/App.css`
- Modify: `src/types.ts`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

Update UI tests to assert the jam UI can display lane states such as:

- `Ready`
- `Hold`
- `Hit`
- `Sustain`

Extend diagnostics tests to assert the panel can show the track name and per-lane gesture state.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/Diagnostics.test.tsx src/components/screens/JamScreen.test.tsx`
Expected: FAIL because those states are not rendered yet.

**Step 3: Write minimal implementation**

Thread gesture state into store/UI and update the lane cards plus diagnostics so the user sees what each instrument expects in real time. Keep the visual language consistent with the current neon HUD.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/Diagnostics.test.tsx src/components/screens/JamScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/JamScreen.tsx src/components/jam/LaneBar.tsx src/components/jam/LaneCard.tsx src/components/Diagnostics.tsx src/components/Diagnostics.test.tsx src/App.css src/types.ts src/state/store.ts
git commit -m "feat: add gesture feedback and track diagnostics"
```

### Task 9: Verify End-To-End Runtime Behavior

**Files:**
- Modify: `progress.md`
- Review: `src/App.tsx`
- Review: `src/music/mapping.ts`
- Review: `src/music/backing-track.ts`

**Step 1: Write the failing test**

Use the browser loop as the failing gate. Verify and document whether:

- the jam starts with the `Midnight Soul` groove running
- idle users do not generate random bass or keys notes
- deliberate drum/bass/keys gestures update the lane state labels appropriately
- the setup/tutorial copy matches the actual controls

**Step 2: Run test to verify it fails**

Run the web-game client before final polish and note any mismatch between UI text, diagnostics, and runtime state.

Suggested command:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export WEB_GAME_CLIENT="$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js"
node "$WEB_GAME_CLIENT" --url http://127.0.0.1:4173 --actions-json '{"steps":[{"buttons":[],"frames":4}]}' --iterations 1 --pause-ms 250 --screenshot-dir output/midnight-soul-check
```

Expected: identify any runtime mismatches before final adjustments.

**Step 3: Write minimal implementation**

Make only the smallest fixes needed to align runtime behavior with the approved design. Update `progress.md` with root-cause notes, verification evidence, and remaining gaps for future multi-track support.

**Step 4: Run test to verify it passes**

Run:

- `npm run test`
- `npm run build`
- the browser verification loop above

Expected: all automated checks pass and the runtime evidence shows the app in the expected state.

**Step 5: Commit**

```bash
git add progress.md src/App.tsx src/music src/components src/state/store.ts src/types.ts
git commit -m "feat: ship midnight soul gameplay and backing groove"
```
