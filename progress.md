Original prompt: checkout the changes we made to improve the UI below. we implemented the detailed jam session with a great visual. I want you to implement the rest of the screens following the design and style we've created, do not stray from the design use it as a strict guideline.

## Completed
- Added setup, permissions, calibration, tutorial, and results screens in the same neon-arcade design language as the new jam screen.
- Wired full phase flow in `App.tsx`: setup -> permissions -> calibration -> tutorial -> jam -> results.
- Added lane instrument selection in setup and mapped it into music event generation.
- Added tutorial progress/confirmation state and high-score persistence in store.
- Added screen tests and mapping test coverage.

## Verification
- `npm run test` passing (17 files / 47 tests).
- `npm run build` passing.
- Playwright web-game loop passing with `playwright_exit=0`.
- Captures reviewed:
  - `output/web-game/shot-0.png` (permissions screen overlay + checklist + CTA)
  - `output/web-game/shot-1.png` (live stage overlay render)
- `state-0.json` / `state-1.json` confirm `render_game_to_text` fields for phase, permissions, tutorial, jam score/timer, and per-lane state.

## Next TODOs
- Add richer Playwright action scripts that exercise setup choices and full run transitions.
- Consider deterministic `advanceTime` implementation for more reliable automation.

## Debug Follow-up (Camera Lifecycle)
- Root-cause evidence: `CameraView` used to stop tracks immediately on unmount, while phase transitions (`permissions -> calibration -> tutorial -> jam`) remount camera containers.
- Implemented shared camera stream handoff in `src/components/CameraView.tsx` with a short grace period to prevent rapid stop/reacquire churn between phase transitions.
- Added regression coverage in `src/components/CameraView.test.tsx`:
  - verifies tracks stop after deliberate stop
  - verifies rapid unmount/remount keeps stream alive and avoids duplicate `getUserMedia` calls

## Gameplay Mechanics Follow-up
- Root-cause evidence for random timing feedback: jam scoring was phase-aligned to session start time instead of the active transport grid. Player-aligned beats could still grade late/good based on start-phase drift.
- Removed autonomous conductor-generated note events from mapping so instrument sounds are player-driven only.
- Added explicit cue-window helpers and transport-grid offset helpers:
  - `src/game/cues.ts`
  - `src/music/transport.ts` (`computeGridOffsetMs`)
- Updated jam flow:
  - score offset now uses transport grid offset
  - cue state is surfaced in HUD + lane cards (`PLAY`/`HOLD`)
  - overlay shows cue strips during hit windows
  - last-10-seconds warning now has center countdown visual plus short audio ticks
- Added tests:
  - `src/game/cues.test.ts`
  - updated `src/music/transport.test.ts`
  - updated `src/music/mapping.test.ts`

## Loop Track + Guide Beat Follow-up
- Added fixed 8-bar arrangement engine in `src/game/arrangement.ts` with tests in `src/game/arrangement.test.ts`:
  - bars 1-4 = Harmony (all lanes active)
  - bars 5-6 = Solo focus (rotates Left -> Middle -> Right per cycle)
  - bars 7-8 = Blend (all lanes active)
- Added new jam timeline UI (`src/components/jam/TrackTimeline.tsx`) with tests in `src/components/jam/TrackTimeline.test.tsx`.
  - Shows bar-by-bar lane activity and moving playhead.
  - Per-lane status now uses stable `PLAY/WAIT` plus beat-window `HIT` pulse.
- Rewired jam screen composition to include timeline and new cue semantics:
  - `src/components/screens/JamScreen.tsx`
  - `src/components/jam/TopHUD.tsx`
  - `src/components/jam/LaneBar.tsx`
  - `src/components/jam/LaneCard.tsx`
- Overlay now reflects arrangement activity (`src/components/OverlayCanvas.tsx`):
  - inactive lanes are visibly dimmed
  - cue strips only show on currently active lanes
- Gameplay event gating now follows arrangement in `src/App.tsx`:
  - player events from inactive lanes are ignored during jam windows
- Added continuous guide beat loop (toggle uses existing store flag, relabeled in UI):
  - `src/music/transport.ts` gains repeat scheduling/clear API
  - `src/App.tsx` schedules quarter-note guide hats during jam when enabled
  - `src/components/Controls.tsx` label changed from `AI Conductor` to `Guide Beat`

## Verification (latest)
- `npm run test` passing (20 files / 59 tests).
- `npm run build` passing.
- Playwright web-game client run completed with exit 0.
  - Latest captures: `output/web-game/shot-0.png`, `output/web-game/shot-1.png`
  - Latest states: `output/web-game/state-0.json`, `output/web-game/state-1.json`
- `npm run lint` currently fails due existing repo lint rules/issues (not newly introduced in this pass), including `react-hooks/refs` in `CameraView` and `TopHUD` plus fast-refresh export warnings.

## Timeline Removal + Score Crash Hardening
- User requested rollback of timeline track UI and investigation of score crash.
- Added regression tests first (RED):
  - `src/components/screens/JamScreen.test.tsx` asserts loop track UI is not rendered.
  - `src/components/jam/TopHUD.test.tsx` reproduces crash path when score numeric fields are missing.
  - `src/components/screens/ResultsScreen.safety.test.tsx` reproduces same crash class in results screen.
- Root-cause evidence (validatable):
  - Before fix, both HUD and results directly called `.toLocaleString()` / `.toFixed()` on score fields without guards.
  - Tests failed with `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` in:
    - `src/components/jam/TopHUD.tsx`
    - `src/components/screens/ResultsScreen.tsx`
- Implemented fixes:
  - Removed timeline from jam render path in `src/components/screens/JamScreen.tsx`.
  - Reverted jam grid layout to 3 rows in `src/App.css`.
  - Hardened score rendering in `src/components/jam/TopHUD.tsx` via numeric guards (`safeNumber`) and removed ref-based score/combo delta render logic.
  - Hardened score rendering in `src/components/screens/ResultsScreen.tsx` with numeric guards for all displayed score values.
- Verification:
  - Targeted tests for new regressions now passing.
  - Full suite passing: `npm run test` (23 files / 62 tests).
  - Build passing: `npm run build`.
  - Scripted browser flow (setup -> permissions -> calibration skip -> tutorial -> jam -> results) with fake media:
    - no console/page errors
    - `hasLoopTrack: 0`
    - HUD and results score elements render (`hudScore: "0"`, `resultsTotal: "0"`)
    - screenshot: `output/debug-no-track-no-crash.png`

## Jam Box Games Launcher
- Added a new `home` entry phase so the app now opens on a main launcher screen instead of going straight into `Jam Hero` setup.
- Added reusable game catalog metadata in `src/game/catalog.ts`.
- Added new screens:
  - `src/components/screens/HomeScreen.tsx`
  - `src/components/screens/ComingSoonScreen.tsx`
- Added launcher tests and app-flow coverage:
  - `src/components/screens/HomeScreen.test.tsx`
  - `src/components/screens/ComingSoonScreen.test.tsx`
  - `src/App.home-flow.test.tsx`
- Added a `Back To Menu` action on results so the launcher is reachable after a run.
- `Jam Hero` now routes straight into the existing setup flow from the launcher.
- `Vs.`, `On Beat`, and `Know Your Lyrics` route to placeholder screens for now.
- Verification:
  - `npm run test` passing (26 files / 65 tests)
  - `npm run build` passing
  - browser verification via Playwright client:
  - launcher state: `output/home-launcher/state-0.json`

## Launcher Brand Asset
- Replaced the temporary CSS-only `Jam Box Games` header mark with the real asset at `public/jambox-games-logo.png`.
- Updated the launcher hero styling in `src/App.css` to frame the image inside the existing neon card without changing the card grid or phase flow.
- User requested no dedicated logo test, so existing launcher/app-flow coverage was kept as-is.
- Verification:
  - `npm run test -- src/components/screens/HomeScreen.test.tsx src/App.home-flow.test.tsx`
  - `npm run build`
  - browser capture via web-game client:
    - screenshot: `output/home-logo-check/shot-0.png`
    - state: `output/home-logo-check/state-0.json` (`mode: "home"`)
    - `Vs.` placeholder state: `output/home-vs/state-0.json`
    - `Jam Hero` setup state: `output/home-jam-hero/state-0.json`
    - screenshots reviewed:
      - `output/home-launcher/shot-0.png`
      - `output/home-vs/shot-0.png`
      - `output/home-jam-hero/shot-0.png`
- Lint still fails due pre-existing issues outside this launcher work:
  - `src/components/CameraView.tsx`
  - `src/components/OverlayCanvas.tsx`
  - `src/components/jam/TimingCallout.tsx`

## Midnight Soul Gameplay Pass
- Added gesture-state feedback plumbing so lane cards and diagnostics reflect the mapper's actual intent phases instead of generic play/wait labels.
- Extended shared types/state with per-lane `gesturePhase` plus diagnostics for `trackTitle` and per-zone gesture state.
- Updated jam lane cues in `src/components/jam/LaneCard.tsx`:
  - `WAIT` for inactive arrangement lanes
  - `READY` when a playable lane is idle
  - `HOLD` for armed bass poses
  - `HIT` during strike/cooldown windows
  - `SUSTAIN` while keys posture is actively held
- Hardened diagnostics rendering and expanded it to show:
  - track title
  - per-zone gesture state
  - safe numeric formatting for runtime metrics
- Wired mapper gesture phases from `src/music/mapping.ts` back into store updates in `src/App.tsx`, so UI/diagnostics reflect live posture state every inference pass.
- Integrated the deterministic `Midnight Soul` backing groove into the live app:
  - added `syncBackingTrackPlayback()` in `src/music/backing-track.ts`
  - created/stopped the backing scheduler from `src/App.tsx` during jam
  - exposed `backingTrackRunning` in `render_game_to_text()` for automation/debug visibility
- Added/updated tests:
  - `src/components/jam/LaneCard.test.tsx`
  - `src/components/Diagnostics.test.tsx`
  - `src/music/backing-track.test.ts`
  - `src/music/gesture-intent.test.ts`
  - `src/components/screens/TutorialScreen.test.tsx`
- Verification:
  - `npm run test` passing (31 files / 78 tests)
  - `npm run build` passing
  - `npm run lint` still fails only on pre-existing issues in:
    - `src/components/CameraView.tsx`
    - `src/components/OverlayCanvas.tsx`
    - `src/components/jam/TimingCallout.tsx`
  - Browser smoke:
    - `npx playwright screenshot --browser chromium --full-page --wait-for-selector "button[aria-label='Jam Hero'], button:has-text('Jam Hero')" http://127.0.0.1:5173/ output/midnight-soul-home.png`

## Integrated Gameplay Branches
- Merged the `codex/midnight-soul` and `codex/gameplay-stabilization` work into one codepath.
- Preserved the `Midnight Soul` backing groove, track metadata, and gesture-intent system.
- Layered in stabilization changes:
  - lane `occupied` state
  - lane `status` (`no_player`, `get_ready`, `hold`, `hit`, `sustain`)
  - skeleton overlay limited to calibration
  - empty-lane scoring/audio gating
  - calmer lane-card cues and diagnostics
- Updated defaults so the app boots Jam Hero with the Midnight Soul BPM (`96`) instead of the older `110` transport default.

## End-Of-Game Audio Scheduling Fix
- Root cause investigated in integrated codepath:
  - the app can schedule countdown warning hits, guide-beat hits, backing-track hits, and player hits onto the same monophonic drum/bass synth instances.
  - Tone rejects repeated source starts at the same start time, which matches the reported runtime error: `Start time must be strictly greater than previous start time`.
- Added a regression test first in `src/music/instruments.voice-pool.test.ts`.
- Fixed by introducing round-robin voice pools in `src/music/instruments.ts` for kick, snare, hat, and bass so simultaneous/near-simultaneous hits do not reuse the same underlying voice immediately.
- Verification:
  - `npm run test` passing (`34` files / `85` tests)
  - `npm run build` passing

## Section Cue Review Follow-up
- Reviewed the uncommitted section-cue implementation against `docs/plans/2026-03-04-jam-hero-section-cues-implementation.md`.
- Root-cause evidence:
  - preview lanes marked `up_next` were also being treated as inactive via `activeZones`, so the upcoming soloist could be muted during the final harmony beat.
  - `evaluateSectionCompliance('up_next')` also blocked scoring/audio, which doubled the regression.
- Added failing tests first:
  - `src/game/arrangement.test.ts` now asserts preview windows keep all harmony lanes active.
  - `src/game/section-scoring.test.ts` now asserts `up_next` is allowed and non-penalized.
- Implemented the minimal runtime fix:
  - `src/game/arrangement.ts` now keeps any non-`wait` lane active.
  - `src/game/section-scoring.ts` now treats `up_next` as allowed/scored instead of blocked.
- Backfilled missing validation that the review called out:
  - `src/components/jam/TopHUD.test.tsx` asserts current/next section cues render.
  - `src/components/screens/JamScreen.test.tsx` asserts the section preview banner renders while the old timeline stays absent.
  - `src/music/instruments.test.ts` now mocks `tone` and verifies the public `triggerWrong()` contract.
- Verification:
  - `npm test` passing (`35` files / `93` tests)
  - `npm run build` passing
  - browser smoke via web-game client:
    - `output/review-section-cues/shot-0.png`
    - `output/review-section-cues/state-0.json`
    - no console/page errors reported by the Playwright client

## Jam Camera Carry-Over Fix
- Root-cause evidence: calibration/tutorial use full-screen phase shells with absolute live preview layers, but `JamScreen` was mounted in a plain `.jam-screen` container whose stage row could collapse because `.jam-stage` only contained absolutely positioned camera/overlay children.
- Implemented fix:
  - `src/components/screens/JamScreen.tsx` now uses a labeled `section` with `phase-screen jam-screen` so jam inherits the full-screen camera shell semantics.
  - `src/App.css` now gives `.app-shell` a definite viewport height and hardens `.jam-screen` / `.jam-stage` sizing so the stage row keeps real space during jam.
- Verification:
  - `npm test -- src/components/screens/JamScreen.test.tsx src/App.home-flow.test.tsx`
  - `npm run build`
- Follow-up: live browser confirmation on the laptop is still recommended because local CI cannot validate the physical webcam stream.
