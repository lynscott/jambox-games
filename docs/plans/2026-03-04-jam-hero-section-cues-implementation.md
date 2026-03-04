# Jam Hero Section Cues Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add clear current/next section cues, lane role states, and wrong-section penalty feedback to Jam Hero so players can follow harmony/solo/blend sections without screen clutter.

**Architecture:** Extend the arrangement model to emit current and upcoming role data, surface that through the jam UI with compact stage and lane cues, and gate scoring/audio through a new section-compliance layer. Keep existing gesture validation and timing scoring intact so penalties only apply to deliberate, validated trigger attempts.

**Tech Stack:** React, TypeScript, Zustand, Tone.js, Vitest

---

### Task 1: Extend Arrangement Metadata

**Files:**
- Modify: `src/game/arrangement.ts`
- Test: `src/game/arrangement.test.ts`

**Step 1: Write the failing test**

Add tests that assert `computeLoopArrangement()` returns:
- `nextSection`
- `nextFocusZone`
- `beatsUntilTransition`
- `roleStates`

Cover at least:
- harmony state with all lanes `play`
- solo state with one `play` lane and two `wait` lanes
- preview window where the next solo lane becomes `up_next`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/game/arrangement.test.ts`
Expected: FAIL because the new fields do not exist yet.

**Step 3: Write minimal implementation**

Update `LoopArrangement` and `computeLoopArrangement()` to derive:
- current section
- next section
- next focus lane
- beats remaining until transition
- per-lane role states

Keep the current section cycle unchanged.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/game/arrangement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/arrangement.ts src/game/arrangement.test.ts
git commit -m "feat: extend arrangement metadata for section cues"
```

### Task 2: Add Lane Role State UI

**Files:**
- Modify: `src/components/jam/LaneCard.tsx`
- Test: `src/components/jam/LaneCard.test.tsx`

**Step 1: Write the failing test**

Add tests for lane cards that assert:
- `PLAY`, `WAIT`, and `UP NEXT` render as the primary role label
- existing gesture state remains available as secondary feedback
- inactive solo lanes show `WAIT`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/jam/LaneCard.test.tsx`
Expected: FAIL because the component does not accept/render role state yet.

**Step 3: Write minimal implementation**

Update the lane card props/UI so:
- arrangement role state is the primary large label
- gesture state remains secondary, smaller, or otherwise visually subordinate
- `lanePlayable` is replaced or internally mapped to explicit role state from arrangement output

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/jam/LaneCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/jam/LaneCard.tsx src/components/jam/LaneCard.test.tsx
git commit -m "feat: add lane role states for section cues"
```

### Task 3: Add Stage Section Banner

**Files:**
- Modify: `src/components/screens/JamScreen.tsx`
- Modify: `src/components/jam/TopHUD.tsx`
- Modify: `src/App.css`
- Test: `src/components/screens/JamScreen.test.tsx`
- Test: `src/components/jam/TopHUD.test.tsx`

**Step 1: Write the failing test**

Add tests that assert jam UI renders:
- current section banner
- next section preview chip when provided

Do not reintroduce a full timeline UI.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/JamScreen.test.tsx src/components/jam/TopHUD.test.tsx`
Expected: FAIL because those section preview elements do not exist yet.

**Step 3: Write minimal implementation**

Add a compact center/top banner to jam screen that shows:
- current section label
- next section preview

Keep the UI restrained and readable from a distance.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/JamScreen.test.tsx src/components/jam/TopHUD.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screens/JamScreen.tsx src/components/jam/TopHUD.tsx src/App.css src/components/screens/JamScreen.test.tsx src/components/jam/TopHUD.test.tsx
git commit -m "feat: add current and next section banner"
```

### Task 4: Add Section Compliance Gate

**Files:**
- Create: `src/game/section-scoring.ts`
- Test: `src/game/section-scoring.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Add tests for a helper that determines whether a validated player event is:
- allowed (`play`)
- preview only (`up_next`)
- wrong-section (`wait`)

Include tests for:
- no penalty in `play`
- no penalty in `up_next`
- penalty in `wait`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/game/section-scoring.test.ts`
Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

Create a small helper module that evaluates section participation state and returns whether to:
- allow scoring
- break combo
- apply penalty

Wire it into the player scoring path in `src/App.tsx` after occupancy and gesture validation but before score application.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/game/section-scoring.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/section-scoring.ts src/game/section-scoring.test.ts src/App.tsx
git commit -m "feat: gate scoring with section compliance"
```

### Task 5: Add Off-Tone Penalty Sound

**Files:**
- Modify: `src/music/instruments.ts`
- Test: `src/music/instruments.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Add test coverage for a new penalty trigger API in the instrument layer.
If audio primitives are difficult to unit test directly, test the public instrument contract and any cooldown helper logic separately.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/instruments.test.ts`
Expected: FAIL because penalty sound support does not exist.

**Step 3: Write minimal implementation**

Add a short penalty sound trigger to `src/music/instruments.ts`.
Add cooldown protection in app-level usage or helper logic so repeated `WAIT` violations do not spam the mix.

Wire it into the wrong-section path in `src/App.tsx`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/instruments.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/music/instruments.ts src/music/instruments.test.ts src/App.tsx
git commit -m "feat: add wrong-section penalty sound"
```

### Task 6: Wire Arrangement Roles Through App State

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `src/state/store.ts` (only if persistent role state is required)
- Test: `src/App.home-flow.test.tsx` or more targeted app-level tests if needed

**Step 1: Write the failing test**

Add a focused test for any new app-level mapping from arrangement data to lane role display/scoring decisions.
If no clean app-level test exists, add small unit helpers instead of broad integration tests.

**Step 2: Run test to verify it fails**

Run the targeted test command.
Expected: FAIL because role-state plumbing is incomplete.

**Step 3: Write minimal implementation**

Ensure `App.tsx` passes arrangement role state into jam UI and uses the same role data for scoring/penalty decisions. Avoid duplicating arrangement logic in multiple places.

**Step 4: Run test to verify it passes**

Run the targeted test command.
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/types.ts src/state/store.ts
git commit -m "refactor: share arrangement role state across jam flow"
```

### Task 7: Full Verification

**Files:**
- Modify as needed based on failures

**Step 1: Run focused tests**

Run:
```bash
npm run test -- src/game/arrangement.test.ts src/components/jam/LaneCard.test.tsx src/components/screens/JamScreen.test.tsx src/components/jam/TopHUD.test.tsx src/game/section-scoring.test.ts src/music/instruments.test.ts
```
Expected: PASS

**Step 2: Run full suite**

Run:
```bash
npm run test
```
Expected: PASS, 0 failures

**Step 3: Run production build**

Run:
```bash
npm run build
```
Expected: PASS

**Step 4: Manual browser verification**

Run:
```bash
npm run dev
```

Verify in browser:
- current section banner is readable
- next section preview appears before transitions
- solo lanes clearly show `PLAY`, other lanes show `WAIT`
- upcoming lane shows `UP NEXT`
- wrong-section validated play causes combo break and subtle penalty sound
- backing track remains the primary tempo reference

**Step 5: Commit final polish**

```bash
git add .
git commit -m "feat: add section cue scoring for jam flow"
```
