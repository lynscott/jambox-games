# Jam Hero Gameplay Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize `Jam Hero` gameplay on `main` by hiding the skeleton outside calibration, hard-gating lane occupancy, replacing cue flicker with stable lane states, and preventing empty sections from producing sounds, score, or hit feedback.

**Architecture:** Add an occupancy-and-intent layer between zoning/features and lane UI/audio logic. Keep the current single-track gameplay flow, but stop using raw beat-window and low energy thresholds as the main source of lane state. Lane cards, score feedback, and event emission should all depend on occupancy plus validated lane state.

**Tech Stack:** React, TypeScript, Zustand, existing Vite app shell, Tone.js, Vitest

---

### Task 1: Add Lane Occupancy And Stable Cue Types

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Step 1: Write the failing test**

Extend `src/state/store.test.ts` to assert:

- each lane carries an `occupied` flag
- each lane carries a stable cue/status label field, or equivalent intent phase field
- default lane state initializes as unoccupied with neutral status

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/state/store.test.ts`
Expected: FAIL because lane state does not include occupancy or stable cue state.

**Step 3: Write minimal implementation**

Update `src/types.ts` and `src/state/store.ts` to add the smallest lane state contract needed for stabilization, for example:

- `occupied: boolean`
- `status: 'no_player' | 'get_ready' | 'hold' | 'hit' | 'sustain'`
- optional `lastSeenAt` if needed locally later

Keep defaults explicit and avoid speculative fields.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/state/store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types.ts src/state/store.ts src/state/store.test.ts
git commit -m "feat: add lane occupancy state"
```

### Task 2: Hide Skeleton Outside Calibration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/screens/JamScreen.test.tsx`
- Modify: `src/components/screens/TutorialScreen.test.tsx`
- Add or modify: test covering calibration overlay visibility if needed

**Step 1: Write the failing test**

Add coverage that asserts:

- skeleton drawing is enabled during `calibration`
- skeleton drawing is disabled during `tutorial`
- skeleton drawing is disabled during `jam`

Use the smallest test seam available, likely by asserting the `OverlayCanvas` draw path receives `enabled/showSkeleton` values derived from phase.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/JamScreen.test.tsx src/components/screens/TutorialScreen.test.tsx`
Expected: FAIL because gameplay still uses the live skeleton setting outside calibration.

**Step 3: Write minimal implementation**

Update `src/App.tsx` so skeleton rendering is forced on only in `calibration`. Ignore the runtime skeleton toggle during tutorial/jam for this pass.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/JamScreen.test.tsx src/components/screens/TutorialScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx src/components/screens/JamScreen.test.tsx src/components/screens/TutorialScreen.test.tsx
git commit -m "feat: limit skeleton overlay to calibration"
```

### Task 3: Add Occupancy Gating Tests In Feature Or Mapping Layer

**Files:**
- Modify: `src/pose/features.ts`
- Modify: `src/pose/features.test.ts`
- Modify: `src/music/mapping.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- when a zone has no pose, the resulting lane behavior becomes unoccupied
- brief pose loss does not instantly clear occupancy if the grace window is active
- fully empty lanes do not trigger `bass` or `pad` events

If the occupancy grace logic lives outside `features.ts`, put the authoritative tests in `src/music/mapping.test.ts` or a new dedicated gameplay-state test.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/pose/features.test.ts src/music/mapping.test.ts`
Expected: FAIL because empty-lane residual energy can still influence event emission.

**Step 3: Write minimal implementation**

Implement occupancy gating in the narrowest correct place. Recommended behavior:

- when no pose exists, mark the lane unoccupied after a short grace window
- once unoccupied, event mapping must treat the lane as unavailable regardless of stale energy
- activity should decay quickly but occupancy truth should drive audio eligibility

Avoid trying to fully redesign gesture logic in this task.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/pose/features.test.ts src/music/mapping.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pose/features.ts src/pose/features.test.ts src/music/mapping.test.ts
git commit -m "feat: gate empty lanes from gameplay events"
```

### Task 4: Replace Flashing Beat Cues With Stable Lane Status Rules

**Files:**
- Modify: `src/components/jam/LaneCard.tsx`
- Create or modify: `src/components/jam/LaneCard.test.tsx`
- Modify: `src/components/jam/LaneBar.tsx` if needed
- Modify: `src/App.css`

**Step 1: Write the failing test**

Create or extend `src/components/jam/LaneCard.test.tsx` to assert:

- unoccupied lane renders `NO PLAYER`
- occupied idle lane renders `GET READY`
- armed/holding lane renders `HOLD`
- actual trigger/cooldown state renders `HIT`
- sustaining keys renders `SUSTAIN`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/jam/LaneCard.test.tsx`
Expected: FAIL because the current lane card only renders `PLAY`, `HIT`, or `WAIT`.

**Step 3: Write minimal implementation**

Refactor `src/components/jam/LaneCard.tsx` to derive its label from stable lane status rather than global beat-window state. Update styles in `src/App.css` so these statuses read clearly and do not flicker every beat.

Keep `HIT` as a short event state only.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/jam/LaneCard.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/jam/LaneCard.tsx src/components/jam/LaneCard.test.tsx src/components/jam/LaneBar.tsx src/App.css
git commit -m "feat: add stable lane status cues"
```

### Task 5: Add Instrument-Specific Ready/Hold/Sustain Mapping

**Files:**
- Modify: `src/music/mapping.ts`
- Modify: `src/music/mapping.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

Extend `src/music/mapping.test.ts` to assert:

- drums require a real strike before `HIT`
- bass requires a stable hold posture before a valid pulse can trigger
- keys require hold posture before entering sustain
- occupied but not-ready players stay in `GET READY` instead of producing events

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/mapping.test.ts`
Expected: FAIL because the current mapper still emits from low thresholds instead of stable readiness states.

**Step 3: Write minimal implementation**

Refactor mapping so it also outputs per-lane gameplay status in addition to music events. Keep it lightweight if a full gesture-intent engine is not yet being backported from the Midnight Soul branch.

Minimum expected behavior:

- `drums`: occupied + visible motion -> `GET READY`; clear strike -> `HIT`
- `bass`: occupied without stable pose -> `GET READY`; stable angle -> `HOLD`; pulse after hold -> `HIT`
- `keys`: occupied posture forming -> `HOLD`; valid hold duration -> `SUSTAIN`

Store the resulting lane status in Zustand so the UI can render it directly.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/mapping.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/mapping.ts src/music/mapping.test.ts src/App.tsx src/state/store.ts
git commit -m "feat: add stable gameplay intent states"
```

### Task 6: Gate Score Feedback And Hit Flashes By Occupancy

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/game/scoring.test.ts` or add focused app-level test if better seam exists
- Modify: `src/components/jam/TimingCallout.tsx` if needed

**Step 1: Write the failing test**

Add coverage that asserts:

- unoccupied lanes do not receive score events
- unoccupied lanes do not show hit flashes or grade popups
- occupied valid hits still score normally

Put the test at the narrowest seam that can express the rule clearly.

**Step 2: Run test to verify it fails**

Run: targeted test command for the chosen file
Expected: FAIL because current app flow can still score events from zones that are visually empty but retain residual feature energy.

**Step 3: Write minimal implementation**

Update the event processing path in `src/App.tsx` so scoring and visual hit feedback run only when the lane is occupied and the emitted event is a valid player action from the current lane state.

**Step 4: Run test to verify it passes**

Run: targeted test command for the chosen file
Expected: PASS.

**Step 5: Commit**

```bash
git add src/App.tsx src/game/scoring.test.ts src/components/jam/TimingCallout.tsx
git commit -m "feat: suppress empty-lane scoring feedback"
```

### Task 7: Tighten Jam Diagnostics And Instruction Copy

**Files:**
- Modify: `src/components/Diagnostics.tsx`
- Modify: `src/components/Diagnostics.test.tsx`
- Modify: `src/components/jam/LaneCard.tsx`
- Modify: `src/components/screens/TutorialScreen.tsx`

**Step 1: Write the failing test**

Add assertions that diagnostics or visible lane UI expose enough real-time status to debug the stabilized loop:

- occupancy per lane
- current stable lane status
- no generic motion-only copy for bass/pad

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/Diagnostics.test.tsx`
Expected: FAIL because diagnostics do not surface stable gameplay states yet.

**Step 3: Write minimal implementation**

Update diagnostics and lane hints so the player and developer can see:

- whether a lane is occupied
- what stable state the lane is in
- concise instrument guidance tied to the new posture model

Keep the panel readable and avoid adding low-value metrics.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/Diagnostics.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Diagnostics.tsx src/components/Diagnostics.test.tsx src/components/jam/LaneCard.tsx src/components/screens/TutorialScreen.tsx
git commit -m "feat: improve gameplay diagnostics and guidance"
```

### Task 8: Full Verification And Regression Check

**Files:**
- Modify if needed: `progress.md`
- Review: existing affected gameplay files

**Step 1: Run full automated verification**

Run:

```bash
npm run test
npm run build
npm run lint
```

Expected:

- tests pass
- build passes
- lint either passes or fails only on pre-existing known files not touched in this pass

**Step 2: Perform manual browser verification**

Run the app and verify:

- calibration shows skeleton
- tutorial and jam hide skeleton
- empty zones stay quiet and do not flash as playable
- a player in a lane sees `GET READY`, `HOLD`, `HIT`, or `SUSTAIN` instead of constant beat flicker

**Step 3: Record outcome**

Append a short section to `progress.md` summarizing:

- the stabilized lane-state model
- skeleton-visibility behavior
- occupancy gating behavior
- verification status

**Step 4: Commit**

```bash
git add progress.md
git commit -m "docs: record gameplay stabilization pass"
```
