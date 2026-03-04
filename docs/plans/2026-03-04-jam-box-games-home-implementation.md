# Jam Box Games Home Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `Jam Box Games` home screen with four equal game tiles, route `Jam Hero` into the existing playable flow, and add placeholder screens for the other three game modes.

**Architecture:** Keep the app as a single phase-based React application. Extend `GamePhase` with a new `home` entry point and three explicit placeholder phases, then render new home and placeholder screens without changing the existing `Jam Hero` runtime logic beyond its entry and return points.

**Tech Stack:** React, TypeScript, Zustand, Vitest, existing neon-arcade CSS system

---

### Task 1: Add Home And Placeholder Flow Tests

**Files:**
- Create: `src/components/screens/HomeScreen.test.tsx`
- Create: `src/components/screens/ComingSoonScreen.test.tsx`
- Modify: `src/components/screens/JamScreen.test.tsx`
- Modify: `src/types.ts`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

Add tests that assert:

- the home screen renders all four game names
- `Jam Hero` can be selected from the home screen
- the generic placeholder screen renders title, description, and back action

Add or update app-flow tests so the new default phase assumptions are explicit.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/HomeScreen.test.tsx src/components/screens/ComingSoonScreen.test.tsx`

Expected: FAIL because the components or phase types do not exist yet.

**Step 3: Write minimal implementation**

Create test scaffolding only as needed for the next task to compile:

- extend `GamePhase` in `src/types.ts`
- extend initial state in `src/state/store.ts` to support the new phases

Do not implement real UI in this task.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/HomeScreen.test.tsx src/components/screens/ComingSoonScreen.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screens/HomeScreen.test.tsx src/components/screens/ComingSoonScreen.test.tsx src/types.ts src/state/store.ts
git commit -m "test: add home screen flow coverage"
```

### Task 2: Implement Home Screen UI

**Files:**
- Create: `src/components/screens/HomeScreen.tsx`
- Modify: `src/App.css`
- Modify: `src/styles/neon-arcade.css`

**Step 1: Write the failing test**

Ensure `src/components/screens/HomeScreen.test.tsx` asserts:

- four equal game cards render
- each card shows title and status
- the `Jam Box Games` brand heading renders
- clicking card actions calls the correct callback

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/HomeScreen.test.tsx`

Expected: FAIL because the UI and interactions do not exist yet.

**Step 3: Write minimal implementation**

Build `HomeScreen.tsx` with:

- top brand hero
- 2x2 game grid
- static metadata for four games
- callback props for selection
- CSS-driven placeholder logo marks per game

Add only the CSS needed for the screen to match the current neon-arcade language.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/HomeScreen.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screens/HomeScreen.tsx src/components/screens/HomeScreen.test.tsx src/App.css src/styles/neon-arcade.css
git commit -m "feat: add Jam Box Games home screen"
```

### Task 3: Implement Placeholder Screen UI

**Files:**
- Create: `src/components/screens/ComingSoonScreen.tsx`
- Modify: `src/App.css`
- Test: `src/components/screens/ComingSoonScreen.test.tsx`

**Step 1: Write the failing test**

Assert that the placeholder screen:

- renders the passed game title
- renders supporting description text
- shows `Coming Soon`
- calls `onBack` when the back action is clicked

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/ComingSoonScreen.test.tsx`

Expected: FAIL because the component does not exist yet.

**Step 3: Write minimal implementation**

Create a reusable placeholder screen component that accepts:

- `title`
- `description`
- `onBack`

Use the existing phase-card pattern and keep copy concise.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/ComingSoonScreen.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screens/ComingSoonScreen.tsx src/components/screens/ComingSoonScreen.test.tsx src/App.css
git commit -m "feat: add coming soon game placeholder screen"
```

### Task 4: Wire App Phase Transitions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/screens/ResultsScreen.tsx`
- Modify: `src/components/screens/ResultsScreen.test.tsx`
- Modify: `src/state/store.ts`
- Modify: `src/types.ts`

**Step 1: Write the failing test**

Add tests that verify:

- app starts on `home`
- selecting `Jam Hero` enters `setup`
- selecting `Vs.`, `On Beat`, or `Know Your Lyrics` enters the correct placeholder screen
- placeholder screen `Back To Menu` returns to `home`
- results screen offers a menu return path

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/ResultsScreen.test.tsx src/components/screens/JamScreen.test.tsx`

Expected: FAIL because phase transitions are not yet wired.

**Step 3: Write minimal implementation**

Update `App.tsx` to:

- render `HomeScreen`
- render `ComingSoonScreen` for three explicit placeholder phases
- change initial entry from `setup` to `home`
- add handlers for game selection and menu return

Update `ResultsScreen` to expose a `Back To Menu` action while preserving `Play Again` and `Change Setup`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/ResultsScreen.test.tsx src/components/screens/HomeScreen.test.tsx src/components/screens/ComingSoonScreen.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/components/screens/ResultsScreen.tsx src/components/screens/ResultsScreen.test.tsx src/state/store.ts src/types.ts
git commit -m "feat: wire home menu and placeholder phase transitions"
```

### Task 5: Polish And Verify End-To-End

**Files:**
- Modify: `progress.md`
- Review: `src/App.css`
- Review: `src/components/screens/HomeScreen.tsx`
- Review: `src/components/screens/ComingSoonScreen.tsx`

**Step 1: Write the failing test**

Use the existing browser verification loop to confirm:

- home screen loads first
- all four games are visible
- `Jam Hero` still reaches setup
- placeholder games open and return correctly

No new unit tests are required if coverage already exists; the failing condition is runtime verification.

**Step 2: Run test to verify it fails**

Run a browser flow before final polish if needed and note any visual or transition issues.

Expected: identify any gaps before final adjustments.

**Step 3: Write minimal implementation**

Make only the CSS and copy adjustments necessary to:

- keep the home screen visually aligned with the current neon system
- keep the launcher responsive on mobile
- avoid breaking existing `Jam Hero` flow

Update `progress.md` with feature notes and verification.

**Step 4: Run test to verify it passes**

Run:

- `npm run test`
- `npm run build`
- browser verification with the existing Playwright client or direct Playwright script

Expected: all pass, no new app-flow regressions.

**Step 5: Commit**

```bash
git add progress.md src/App.css src/App.tsx src/components/screens src/state/store.ts src/types.ts
git commit -m "feat: add Jam Box Games launcher home flow"
```
