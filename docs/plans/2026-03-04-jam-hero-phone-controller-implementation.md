# Jam Hero Phone Controller Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace camera-driven Jam Hero gameplay with a host-authoritative phone-controller flow where players watch a three-lane host chart and trigger their locked instrument from their phones.

**Architecture:** Reuse the existing lobby WebSocket path for phone pairing and event transport. The host generates a deterministic Jam Hero cue chart, renders the flowing lanes, owns scoring and audio playback, and accepts discrete phone input events with lightweight clock-sync correction. Phones stay intentionally thin: big tap target first, optional motion accent second.

**Tech Stack:** React, TypeScript, Zustand, Vite, Vitest, existing WebSocket lobby server, Tone.js

---

### Task 1: Add Jam Hero Phone Protocol Types

**Files:**
- Modify: `src/network/lobbyProtocol.ts`
- Test: `src/network/lobbyProtocol.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { ClientMessage, ServerMessage } from './lobbyProtocol';

describe('jam hero phone protocol', () => {
  it('accepts jam hero host-to-phone and phone-to-host messages', () => {
    const serverMessage: ServerMessage = {
      type: 'jam_hero_state',
      state: {
        game: 'jam_hero',
        sessionId: 1,
        status: 'countdown',
        bpm: 96,
        serverTimeMs: 1_000,
        section: 'harmony',
        nextSection: 'solo',
        laneAssignments: { left: 1, middle: 2, right: null },
      },
    };

    const clientMessage: ClientMessage = {
      type: 'jam_hero_input',
      event: {
        sessionId: 1,
        playerSlot: 1,
        lane: 'left',
        inputType: 'tap',
        clientTimeMs: 1_005,
        sequence: 4,
      },
    };

    expect(serverMessage.type).toBe('jam_hero_state');
    expect(clientMessage.type).toBe('jam_hero_input');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/network/lobbyProtocol.test.ts`
Expected: FAIL because Jam Hero phone message types do not exist yet.

**Step 3: Write minimal implementation**

- Add Jam Hero phone-mode interfaces to `src/network/lobbyProtocol.ts`
- Define:
  - `JamHeroLane = 'left' | 'middle' | 'right'`
  - `JamHeroInputType = 'tap' | 'accent_start' | 'accent_end'`
  - `JamHeroLiveState`
  - `JamHeroInputEvent`
  - `JamHeroFeedback`
- Extend `ServerMessage` and `ClientMessage` with:
  - `jam_hero_state`
  - `jam_hero_feedback`
  - `jam_hero_ready`
  - `jam_hero_input`
  - `clock_ping`
  - `clock_pong`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/network/lobbyProtocol.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/network/lobbyProtocol.ts src/network/lobbyProtocol.test.ts
git commit -m "feat: add jam hero phone protocol types"
```

### Task 2: Add Jam Hero Chart Model

**Files:**
- Create: `src/game/jam-hero-chart.ts`
- Test: `src/game/jam-hero-chart.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildJamHeroChart } from './jam-hero-chart';

describe('buildJamHeroChart', () => {
  it('creates deterministic cues for all lanes and sections', () => {
    const chart = buildJamHeroChart({
      bpm: 96,
      durationSec: 60,
      laneAssignments: { left: 1, middle: 2, right: null },
    });

    expect(chart.cues.length).toBeGreaterThan(0);
    expect(chart.cues.some((cue) => cue.lane === 'left')).toBe(true);
    expect(chart.cues.some((cue) => cue.lane === 'middle')).toBe(true);
    expect(chart.cues.some((cue) => cue.lane === 'right')).toBe(true);
    expect(chart.sections.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/game/jam-hero-chart.test.ts`
Expected: FAIL because the chart builder does not exist.

**Step 3: Write minimal implementation**

- Add `buildJamHeroChart()` that returns:
  - `cues`
  - `sections`
  - `durationMs`
- Keep the first chart deterministic and hard-coded around the existing Midnight Soul feel
- Include `lane`, `cueIndex`, `timeMs`, `durationMs`, `kind`, `sectionRole`, and `accentable`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/game/jam-hero-chart.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/jam-hero-chart.ts src/game/jam-hero-chart.test.ts
git commit -m "feat: add jam hero cue chart builder"
```

### Task 3: Add Phone-Input Scoring Matcher

**Files:**
- Create: `src/game/jam-hero-phone-scoring.ts`
- Test: `src/game/jam-hero-phone-scoring.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { scorePhoneInputAgainstChart } from './jam-hero-phone-scoring';

describe('scorePhoneInputAgainstChart', () => {
  it('grades the nearest valid cue in the same lane', () => {
    const result = scorePhoneInputAgainstChart({
      lane: 'left',
      eventTimeMs: 1_020,
      cues: [
        { cueIndex: 1, lane: 'left', timeMs: 1_000, durationMs: 0, kind: 'tap', sectionRole: 'play', accentable: false },
      ],
      perfectWindowMs: 35,
      goodWindowMs: 80,
      consumedCueIndexes: new Set(),
    });

    expect(result.grade).toBe('perfect');
    expect(result.offsetMs).toBe(20);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/game/jam-hero-phone-scoring.test.ts`
Expected: FAIL because the matcher does not exist.

**Step 3: Write minimal implementation**

- Add a lane-local cue matcher
- Score against the next unconsumed valid cue in that lane
- Return:
  - `grade`
  - `offsetMs`
  - `matchedCueIndex`
  - `strayTap`
- Support stray-tap detection for `WAIT` windows

**Step 4: Run test to verify it passes**

Run: `npm test -- src/game/jam-hero-phone-scoring.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/jam-hero-phone-scoring.ts src/game/jam-hero-phone-scoring.test.ts
git commit -m "feat: add jam hero phone scoring matcher"
```

### Task 4: Add Host/Phone Jam Hero Session State

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Step 1: Write the failing test**

```ts
it('stores jam hero phone lane assignments and connection state', () => {
  const state = createInitialState();
  expect(state.jamHeroPhone).toEqual({
    enabled: false,
    laneAssignments: { left: null, middle: null, right: null },
    readySlots: { 1: false, 2: false, 3: false },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/state/store.test.ts`
Expected: FAIL because the store shape does not exist.

**Step 3: Write minimal implementation**

- Extend shared types with Jam Hero phone session state
- Add store state and actions for:
  - enabling phone-controller Jam Hero mode
  - lane assignment
  - ready status
  - connection latency display
  - current chart/session metadata

**Step 4: Run test to verify it passes**

Run: `npm test -- src/state/store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts src/state/store.ts src/state/store.test.ts
git commit -m "feat: add jam hero phone session state"
```

### Task 5: Extend Lobby Session And Server For Jam Hero Events

**Files:**
- Modify: `src/lobby/useLobbySession.tsx`
- Modify: `server/ws-lobby-server.mjs`
- Test: `src/lobby/useLobbySession.test.tsx`

**Step 1: Write the failing test**

```ts
it('records jam hero state and feedback from the lobby transport', () => {
  // simulate onMessage with jam_hero_state and jam_hero_feedback
  // assert lobby session exposes the updated values
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lobby/useLobbySession.test.tsx`
Expected: FAIL because Jam Hero messages are ignored.

**Step 3: Write minimal implementation**

- Extend the lobby session context with:
  - `jamHeroState`
  - `jamHeroFeedback`
  - `sendJamHeroInput`
  - `sendJamHeroReady`
  - `sendClockPing`
- Update `server/ws-lobby-server.mjs` to relay the new Jam Hero messages between host and paired phones
- Keep routing simple: one lobby host, up to three paired phones

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lobby/useLobbySession.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lobby/useLobbySession.tsx server/ws-lobby-server.mjs src/lobby/useLobbySession.test.tsx
git commit -m "feat: route jam hero phone events through lobby session"
```

### Task 6: Build Jam Hero Phone Controller Screen

**Files:**
- Modify: `src/components/screens/PhonePlayerScreen.tsx`
- Test: `src/components/screens/PhonePlayerScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders the jam hero phone controller with a locked lane and tap surface', () => {
  render(<PhonePlayerScreen lobbyCode="AB12CD" playerSlot={1} />);
  expect(screen.getByText(/jam hero/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /tap pad/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/screens/PhonePlayerScreen.test.tsx`
Expected: FAIL because Jam Hero phone UI does not exist.

**Step 3: Write minimal implementation**

- Add Jam Hero phone controller rendering path to `PhonePlayerScreen`
- Show:
  - locked instrument/lane
  - connection status
  - big tap pad button
  - last grade feedback
  - optional motion-permission CTA
- On tap:
  - send `jam_hero_input`
  - include `sequence`, `clientTimeMs`, `lane`, `playerSlot`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/screens/PhonePlayerScreen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/screens/PhonePlayerScreen.tsx src/components/screens/PhonePlayerScreen.test.tsx
git commit -m "feat: add jam hero phone controller screen"
```

### Task 7: Build Host Cue Track Screen

**Files:**
- Create: `src/components/jam/JamHeroTrackView.tsx`
- Modify: `src/components/screens/JamScreen.tsx`
- Modify: `src/App.css`
- Test: `src/components/jam/JamHeroTrackView.test.tsx`
- Test: `src/components/screens/JamScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders three always-visible cue lanes with active emphasis', () => {
  render(<JamHeroTrackView chart={chart} nowMs={1000} laneAssignments={{ left: 1, middle: 2, right: null }} />);
  expect(screen.getByText(/left/i)).toBeInTheDocument();
  expect(screen.getByText(/middle/i)).toBeInTheDocument();
  expect(screen.getByText(/right/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/jam/JamHeroTrackView.test.tsx src/components/screens/JamScreen.test.tsx`
Expected: FAIL because the host chart renderer does not exist.

**Step 3: Write minimal implementation**

- Create a dedicated flowing-lane renderer for Jam Hero phone mode
- Keep three lanes always visible
- Brighten the currently active/solo lane
- Show cue blocks moving through a hit zone
- Keep the existing neon design language

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/jam/JamHeroTrackView.test.tsx src/components/screens/JamScreen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/jam/JamHeroTrackView.tsx src/components/jam/JamHeroTrackView.test.tsx src/components/screens/JamScreen.tsx src/App.css src/components/screens/JamScreen.test.tsx
git commit -m "feat: add jam hero host cue track view"
```

### Task 8: Wire Host Jam Logic To Phone Events

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/music/backing-track.ts`
- Modify: `src/music/instruments.ts`
- Test: `src/App.home-flow.test.tsx`
- Test: `src/music/backing-track.test.ts`

**Step 1: Write the failing test**

```tsx
it('uses phone-driven events for jam hero when phone mode is enabled', () => {
  // render app with jam hero phone mode state
  // simulate accepted phone event
  // assert score/audio path updates without camera dependency
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.home-flow.test.tsx src/music/backing-track.test.ts`
Expected: FAIL because Jam Hero still depends on camera/mapping flow.

**Step 3: Write minimal implementation**

- Add a Jam Hero phone-mode branch in `App.tsx`
- For this branch:
  - do not start camera pose inference
  - use the generated chart and lobby phone events
  - match inputs with `scorePhoneInputAgainstChart()`
  - update score/lane feedback from matched cues
  - trigger host audio only after the host accepts an input
- Keep deterministic auto-support for unoccupied lanes

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.home-flow.test.tsx src/music/backing-track.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/music/backing-track.ts src/music/instruments.ts src/App.home-flow.test.tsx src/music/backing-track.test.ts
git commit -m "feat: drive jam hero host gameplay from phone inputs"
```

### Task 9: Add Clock Sync And Connection Diagnostics

**Files:**
- Create: `src/network/clock-sync.ts`
- Test: `src/network/clock-sync.test.ts`
- Modify: `src/components/Diagnostics.tsx`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { estimateClockOffset } from './clock-sync';

describe('estimateClockOffset', () => {
  it('computes a usable host offset from ping/pong timestamps', () => {
    const result = estimateClockOffset({
      clientSentAtMs: 1000,
      clientReceivedAtMs: 1060,
      serverTimeMs: 1035,
    });

    expect(result.rttMs).toBe(60);
    expect(result.offsetMs).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/network/clock-sync.test.ts`
Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

- Add a small pure helper for RTT/offset estimation
- Surface per-phone latency in diagnostics
- Keep the algorithm intentionally simple for local-network play

**Step 4: Run test to verify it passes**

Run: `npm test -- src/network/clock-sync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/network/clock-sync.ts src/network/clock-sync.test.ts src/components/Diagnostics.tsx src/App.tsx
git commit -m "feat: add jam hero phone clock sync diagnostics"
```

### Task 10: Remove Camera-First Jam Hero From Main Path

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/screens/SetupScreen.tsx`
- Modify: `README.md`
- Test: `src/components/screens/SetupScreen.test.tsx`

**Step 1: Write the failing test**

```tsx
it('describes jam hero as a phone-controlled experience in setup', () => {
  render(<SetupScreen onStartSession={vi.fn()} onBackToMenu={vi.fn()} />);
  expect(screen.getByText(/pair phones/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/screens/SetupScreen.test.tsx`
Expected: FAIL because setup still frames Jam Hero around camera play.

**Step 3: Write minimal implementation**

- Update setup copy and launch path so Jam Hero phone mode is the primary route
- Hide or remove camera calibration/tutorial steps from the primary Jam Hero path
- Update README to explain host + phone flow, local Wi‑Fi expectations, and fallback behavior for missing lanes

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/screens/SetupScreen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/components/screens/SetupScreen.tsx src/components/screens/SetupScreen.test.tsx README.md
git commit -m "docs: reframe jam hero around phone controller flow"
```

### Task 11: Full Verification

**Files:**
- Modify as needed based on failures

**Step 1: Run focused tests**

Run:

```bash
npm test -- src/network/lobbyProtocol.test.ts src/game/jam-hero-chart.test.ts src/game/jam-hero-phone-scoring.test.ts src/network/clock-sync.test.ts
```

Expected: PASS

**Step 2: Run UI and app tests**

Run:

```bash
npm test -- src/components/screens/PhonePlayerScreen.test.tsx src/components/jam/JamHeroTrackView.test.tsx src/components/screens/JamScreen.test.tsx src/App.home-flow.test.tsx
```

Expected: PASS

**Step 3: Run full suite**

Run:

```bash
npm test
```

Expected: PASS

**Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS

**Step 5: Browser verification**

Run the host app and verify:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:4173/ --actions-json '{"steps":[{"buttons":[],"frames":2}]}' --iterations 1 --pause-ms 300 --screenshot-dir output/jam-hero-phone-host
```

Also manually verify:

- host lobby screen shows paired Jam Hero lanes
- phone route loads `PhonePlayerScreen` Jam Hero controller
- host chart lanes remain visible
- accepted taps trigger score/audio
- missing lane auto-support remains musical

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add phone-controlled jam hero flow"
```
