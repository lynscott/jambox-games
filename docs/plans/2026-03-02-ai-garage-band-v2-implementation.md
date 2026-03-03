# AI Garage Band V2 Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the app into a mode-driven collaborative jam game with clear instrument guidance, consistency-first scoring, and polished UX.

**Architecture:** Introduce an explicit game state machine (`setup`, `calibration`, `tutorial`, `jam`, `results`) with deterministic transition guards and timer-driven progression. Split state into dedicated slices so UI flow, pose runtime, audio runtime, and scoring evolve independently. Keep pose/audio core local-first and integrate optional AI extensions only after core is stable.

**Tech Stack:** React, TypeScript, Zustand, Tone.js, TFJS MoveNet, Vitest, Testing Library, Playwright interaction loop (@superpowers/test-driven-development, @skills/develop-web-game).

---

### Task 1: Build Core Game State Machine

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/stateMachine.ts`
- Test: `src/game/stateMachine.test.ts`
- Modify: `src/state/store.ts`
- Modify: `src/types.ts`

**Step 1: Write the failing test**

```ts
it('follows setup -> calibration -> tutorial -> jam -> results transitions', () => {
  const machine = createGameStateMachine();
  expect(machine.mode).toBe('setup');
  machine.transition('BEGIN_CALIBRATION');
  machine.transition('CALIBRATION_COMPLETE');
  machine.transition('TUTORIAL_COMPLETE');
  machine.transition('JAM_COMPLETE');
  expect(machine.mode).toBe('results');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/game/stateMachine.test.ts`
Expected: FAIL because state machine module does not exist.

**Step 3: Write minimal implementation**
- Add game mode/event types and transition guards.
- Add pure reducer-like transition function.
- Wire mode state into Zustand store.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/game/stateMachine.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/game/types.ts src/game/stateMachine.ts src/game/stateMachine.test.ts src/state/store.ts src/types.ts
git commit -m "feat: add explicit game state machine and mode transitions"
```

### Task 2: Add Setup Screen with Lane Instrument Selection and Timer

**Files:**
- Create: `src/components/screens/SetupScreen.tsx`
- Test: `src/components/screens/SetupScreen.test.tsx`
- Modify: `src/state/store.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Step 1: Write the failing test**

```tsx
it('locks selected lane instruments and timer on start', async () => {
  render(<SetupScreen />);
  await user.selectOptions(screen.getByLabelText('Left lane'), 'rhythm');
  await user.selectOptions(screen.getByLabelText('Middle lane'), 'bass');
  await user.selectOptions(screen.getByLabelText('Right lane'), 'pad');
  await user.click(screen.getByRole('button', { name: /start session/i }));
  expect(useAppStore.getState().lanesLocked).toBe(true);
  expect(useAppStore.getState().jamDurationSec).toBe(60);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/SetupScreen.test.tsx`
Expected: FAIL due missing setup screen and lane config state.

**Step 3: Write minimal implementation**
- Add lane instrument choices (`rhythm`, `bass`, `pad`) with lock-at-start.
- Add timer selector (`60s`, `90s`).
- Transition to calibration mode after successful start.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/SetupScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/SetupScreen.tsx src/components/screens/SetupScreen.test.tsx src/state/store.ts src/App.tsx src/App.css
git commit -m "feat: add setup screen with lane instrument and timer selection"
```

### Task 3: Rework Calibration into Guided Screen

**Files:**
- Create: `src/components/screens/CalibrationScreen.tsx`
- Test: `src/components/screens/CalibrationScreen.test.tsx`
- Modify: `src/pose/zoning.ts`
- Modify: `src/App.tsx`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

```tsx
it('shows per-lane calibration status and advances when all lanes lock', () => {
  const state = seedCalibrationState();
  render(<CalibrationScreen {...state} />);
  expect(screen.getByText(/left: locked/i)).toBeInTheDocument();
  expect(screen.getByText(/middle: locked/i)).toBeInTheDocument();
  expect(screen.getByText(/right: locked/i)).toBeInTheDocument();
  expect(useAppStore.getState().mode).toBe('tutorial');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/CalibrationScreen.test.tsx`
Expected: FAIL because guided calibration screen and completion guard are missing.

**Step 3: Write minimal implementation**
- Add calibration instructions and per-lane lock indicators.
- Add guard requiring all configured lanes locked.
- Transition to tutorial on success.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/CalibrationScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/CalibrationScreen.tsx src/components/screens/CalibrationScreen.test.tsx src/pose/zoning.ts src/App.tsx src/state/store.ts
git commit -m "feat: add guided calibration screen with lane lock status"
```

### Task 4: Implement Tutorial Mode (8-Beat Gesture Coach)

**Files:**
- Create: `src/components/screens/TutorialScreen.tsx`
- Create: `src/game/tutorial.ts`
- Test: `src/game/tutorial.test.ts`
- Test: `src/components/screens/TutorialScreen.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

```ts
it('completes tutorial after 8 beats and required lane gesture confirmations', () => {
  const session = createTutorialSession(['left', 'middle', 'right']);
  advanceTutorial(session, 8);
  markLaneConfirmed(session, 'left');
  markLaneConfirmed(session, 'middle');
  markLaneConfirmed(session, 'right');
  expect(session.completed).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/game/tutorial.test.ts src/components/screens/TutorialScreen.test.tsx`
Expected: FAIL because tutorial module and screen do not exist.

**Step 3: Write minimal implementation**
- Implement tutorial beat countdown and per-lane gesture confirmation.
- Surface gesture hints per selected instrument.
- Transition to jam mode when tutorial completion criteria are met.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/game/tutorial.test.ts src/components/screens/TutorialScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/TutorialScreen.tsx src/components/screens/TutorialScreen.test.tsx src/game/tutorial.ts src/game/tutorial.test.ts src/App.tsx
git commit -m "feat: add tutorial mode with 8-beat gesture coaching"
```

### Task 5: Build New Scoring Engine (Timing + Consistency + Combo)

**Files:**
- Create: `src/game/scoring.ts`
- Test: `src/game/scoring.test.ts`
- Modify: `src/music/transport.ts`
- Modify: `src/App.tsx`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

```ts
it('rewards on-beat events and increases combo multiplier', () => {
  const score = createScoreState();
  applyEvent(score, { beatDeltaMs: 12, accepted: true, lane: 'left' });
  applyEvent(score, { beatDeltaMs: 18, accepted: true, lane: 'left' });
  expect(score.combo).toBeGreaterThan(1);
  expect(score.total).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/game/scoring.test.ts`
Expected: FAIL because scoring module does not exist.

**Step 3: Write minimal implementation**
- Implement timing grade windows.
- Add consistency accumulator and idle penalties.
- Add combo increment/decay and final score composition.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/game/scoring.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/game/scoring.ts src/game/scoring.test.ts src/music/transport.ts src/App.tsx src/state/store.ts
git commit -m "feat: add consistency-first scoring and combo engine"
```

### Task 6: Refactor Lane Instrument Mapping to Configurable Roles

**Files:**
- Modify: `src/music/mapping.ts`
- Test: `src/music/mapping.test.ts`
- Create: `src/game/instruments.ts`
- Test: `src/game/instruments.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

```ts
it('maps lane events using selected instrument roles instead of hardcoded lanes', () => {
  const events = mapFeaturesToEvents({
    laneConfig: { left: 'pad', middle: 'rhythm', right: 'bass' },
    ...seedMappingInput(),
  });
  expect(events.some((e) => e.zone === 'left' && e.instrument === 'pad')).toBe(true);
  expect(events.some((e) => e.zone === 'middle' && e.instrument === 'drums')).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/music/mapping.test.ts src/game/instruments.test.ts`
Expected: FAIL because mapping is still lane-hardcoded.

**Step 3: Write minimal implementation**
- Add role-to-mapper strategy layer.
- Update mapping function to use selected lane role.
- Preserve conductor constraints and debounce logic.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/music/mapping.test.ts src/game/instruments.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/music/mapping.ts src/music/mapping.test.ts src/game/instruments.ts src/game/instruments.test.ts src/App.tsx
git commit -m "feat: support configurable instrument roles per lane"
```

### Task 7: Redesign Jam HUD for Clear Live Feedback

**Files:**
- Create: `src/components/screens/JamScreen.tsx`
- Create: `src/components/LaneCard.tsx`
- Test: `src/components/screens/JamScreen.test.tsx`
- Test: `src/components/LaneCard.test.tsx`
- Modify: `src/components/OverlayCanvas.tsx`
- Modify: `src/App.css`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

```tsx
it('shows timer, score, combo, lane instrument hints, and hit feedback labels', () => {
  render(<JamScreen {...seedJamUIState()} />);
  expect(screen.getByText(/time: 60/i)).toBeInTheDocument();
  expect(screen.getByText(/combo x2/i)).toBeInTheDocument();
  expect(screen.getByText(/on beat/i)).toBeInTheDocument();
  expect(screen.getByText(/gesture: big down hit/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/screens/JamScreen.test.tsx src/components/LaneCard.test.tsx`
Expected: FAIL because jam HUD and lane cards are missing.

**Step 3: Write minimal implementation**
- Create jam HUD with countdown, score, combo, beat pulse.
- Add lane cards with role icon, gesture instructions, and confidence bars.
- Add immediate event feedback chip (`On Beat`, `Late`, `Great Hit`).

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/screens/JamScreen.test.tsx src/components/LaneCard.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/JamScreen.tsx src/components/screens/JamScreen.test.tsx src/components/LaneCard.tsx src/components/LaneCard.test.tsx src/components/OverlayCanvas.tsx src/App.css src/App.tsx
git commit -m "feat: add polished jam HUD with lane guidance and live feedback"
```

### Task 8: Add Results Screen and Local High Score Persistence

**Files:**
- Create: `src/components/screens/ResultsScreen.tsx`
- Create: `src/game/highScore.ts`
- Test: `src/game/highScore.test.ts`
- Test: `src/components/screens/ResultsScreen.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/state/store.ts`

**Step 1: Write the failing test**

```ts
it('saves new high score and reports delta from previous best', () => {
  saveHighScore('default', 980);
  const outcome = finalizeRun('default', 1120);
  expect(outcome.isNewHigh).toBe(true);
  expect(outcome.delta).toBe(140);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/game/highScore.test.ts src/components/screens/ResultsScreen.test.tsx`
Expected: FAIL because high score module/results screen do not exist.

**Step 3: Write minimal implementation**
- Add localStorage high-score utility with safe fallback.
- Add results screen with score breakdown and replay CTA.
- Transition from jam to results on timer completion.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/game/highScore.test.ts src/components/screens/ResultsScreen.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/screens/ResultsScreen.tsx src/components/screens/ResultsScreen.test.tsx src/game/highScore.ts src/game/highScore.test.ts src/App.tsx src/state/store.ts
git commit -m "feat: add results screen with local high score tracking"
```

### Task 9: Integrate Optional AI Hype Layer (Non-Blocking)

**Files:**
- Create: `src/ai/types.ts`
- Create: `src/ai/service.ts`
- Create: `src/ai/prompts.ts`
- Test: `src/ai/service.test.ts`
- Modify: `src/components/screens/ResultsScreen.tsx`
- Modify: `src/state/store.ts`
- Modify: `.env.example`

**Step 1: Write the failing test**

```ts
it('falls back to local generator when AI provider is unavailable', async () => {
  const service = createAiHypeService({ provider: 'openai', apiKey: '' });
  const result = await service.generateSummary(seedResultInput());
  expect(result.source).toBe('local-fallback');
  expect(result.bandName.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/ai/service.test.ts`
Expected: FAIL because AI service module does not exist.

**Step 3: Write minimal implementation**
- Add provider abstraction with optional OpenAI/ElevenLabs endpoints.
- Add timeouts and fallback local deterministic generator.
- Wire optional “Generate Hype Recap” action into results screen.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/ai/service.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ai/types.ts src/ai/service.ts src/ai/prompts.ts src/ai/service.test.ts src/components/screens/ResultsScreen.tsx src/state/store.ts .env.example
git commit -m "feat: add optional AI hype recap with safe local fallback"
```

### Task 10: End-to-End Flow Validation and Documentation Refresh

**Files:**
- Modify: `README.md`
- Create: `progress.md`
- Create: `scripts/playwright/jam-flow.actions.json`
- Modify: `package.json` (if needed for test script alias)

**Step 1: Write the failing test**
- N/A (validation + documentation task).

**Step 2: Run validation commands**

Run:
- `npm run test`
- `npm run build`
- `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5173 --actions-file scripts/playwright/jam-flow.actions.json --iterations 3 --pause-ms 250`

Expected:
- Unit/integration tests PASS.
- Build PASS.
- Playwright output shows no new console errors and expected screenshots for each mode.

**Step 3: Write minimal implementation/docs**
- Update README for new mode flow, scoring rules, instrument guidance, and AI extension setup.
- Add troubleshooting for calibration/tutorial/jam results flow.
- Record execution notes/TODOs in `progress.md` for handoff safety.

**Step 4: Re-run validation**

Run:
- `npm run test`
- `npm run build`
- Playwright command above again.

Expected: all PASS with stable screenshots and clean console.

**Step 5: Commit**

```bash
git add README.md progress.md scripts/playwright/jam-flow.actions.json package.json
git commit -m "docs: finalize v2 jam flow and validation artifacts"
```
