# Jam Hero Phone Controller Design

## Goal

Replace camera-based Jam Hero input with phone-based controllers so players watch the host display, tap on their phones for timing, and use optional phone motion as a secondary accent input.

## Product Direction

Jam Hero should become a clearer, more reliable party game:

- the host screen is the visual source of truth
- each player phone is locked to one instrument for the full session
- all three instrument lanes remain visible on the host screen at all times
- the host owns timing, scoring, audio playback, and session state
- missing lanes can fall back to deterministic auto-support

This is intentionally not a hybrid pose + phone mode. The phone-controller version replaces camera gameplay for this Jam Hero path.

## Core Experience

### Host Screen

The host display becomes a rhythm-track performance screen rather than a camera/pose screen.

- top HUD shows timer, team score, combo, current section, and next section
- center stage shows three always-visible flowing cue lanes
- the active or solo lane is brighter, but all lanes stay readable
- hit feedback appears on the host screen so all players can react together
- connection health and lane occupancy are visible but secondary

### Phone Screen

Each phone is a simple controller, not a second scoreboard.

- locked lane/instrument label
- connection status
- one large tap surface
- optional motion accent indicator
- immediate hit feedback: `Perfect`, `Good`, `Miss`, `Wait`

Players should mostly look at the host screen and use their phone as an input device.

## Input Model

Recommended controller model: `tap + motion accent`.

### Primary Input

Tap is the main scoring input for all instruments.

- drums: tap for hits
- bass: tap for note cues
- keys: tap for chord stabs, hold for sustain cues later

### Secondary Input

Phone motion is optional and should not be required for core scoring in V1.

- short shake can act as an accent request
- tilt can later modulate a filter or articulation
- motion should never be the only way to hit a cue in the first release

This keeps playability high and avoids browser motion-permission failure becoming a blocker.

## Session Structure

### Lobby And Pairing

- host creates or joins the local lobby
- phones join using the existing phone route
- each phone claims a player slot and a fixed Jam Hero lane
- host sees which lanes are filled and which lanes will be auto-supported

### Setup

- host chooses track, duration, and difficulty
- lane ownership is shown clearly
- once the session starts, instrument assignment is locked

### Jam

- host chart scrolls continuously for all lanes
- current/next section cues remain visible
- phones send input events only
- host scores and triggers audio

### Results

- team score
- lane-by-lane timing summary
- consistency/streak summary
- connection/latency diagnostics if needed

## Architecture

Recommended approach: `host-authoritative WebSocket event stream with clock sync`.

### Why Host-Authoritative

The host should decide:

- current transport time
- cue schedule
- scoring windows
- combo state
- audio scheduling
- section state

Phones should not locally decide whether a hit was correct. They only report input with timestamps and receive feedback.

This is the best tradeoff for fairness, debugging, and local-event reliability.

## Networking Model

The current lobby WebSocket channel is the right starting point. No WebRTC is required for V1.

### New Message Families

Host to phones:

- `jam_hero_state`
- `jam_hero_count_in`
- `jam_hero_feedback`
- `clock_pong`

Phone to host:

- `jam_hero_input`
- `clock_ping`
- `jam_hero_ready`

### Clock Sync

Each phone periodically pings the host:

- phone sends `clientSentAtMs`
- host returns `serverTimeMs` plus the echoed client timestamp
- phone estimates RTT locally
- host keeps a simple per-phone latency estimate for diagnostics

For scoring, the host should use:

- host receipt time
- adjusted estimate from recent phone offset
- sequence numbers to dedupe retries

This is enough for local Wi-Fi without adding protocol complexity too early.

## Cue Chart Model

Jam Hero phone mode should move from inferred arrangement gating to explicit deterministic cue charts.

Each cue should contain:

- `sessionId`
- `lane`
- `cueIndex`
- `timeMs`
- `durationMs`
- `kind`
- `sectionRole`
- `accentable`

V1 cue kinds:

- drums: `tap`
- bass: `tap`
- keys: `tap`
- keys future extension: `hold`

The host uses the cue chart for both:

- rendering the flowing lanes
- matching/scoring incoming phone events

## Scoring

Each player input is matched against the next valid cue for that lane.

Grades:

- `Perfect`
- `Good`
- `Miss`

Penalties:

- missed cue
- stray tap while lane is in `WAIT`
- duplicate tap spam

Team score should continue to favor:

- timing accuracy
- consistency
- combo maintenance

## Audio

The host remains the only audio output device.

- backing/support lanes continue on the host
- player-triggered notes only sound when host accepts the input event
- motion accent can alter velocity/filter/fill behavior later

This keeps all sound aligned to one transport.

## Fallback Behavior

The session must still run with fewer than three phones.

- occupied lanes accept phone input
- unoccupied lanes are auto-supported by deterministic backing patterns
- host UI makes the difference visible

This preserves the three-lane musical shape without forcing exactly three players.

## UI Principles

- host screen must prioritize readability from a distance
- phone UI must prioritize speed and error resistance
- lane ownership must always be obvious
- the player should never need to inspect a skeleton, calibration overlay, or dense debug panel to know what to do

## Risks And Mitigations

### Phone Network Jitter

Mitigation:

- host-authoritative scoring
- lightweight clock sync
- clear connection health indicators

### Browser Motion Permissions

Mitigation:

- tap remains the only required input
- motion accent is optional
- UI should gracefully show “motion unavailable” without breaking gameplay

### Overbuilt First Release

Mitigation:

- V1 should ship with one track and one simple cue-chart format
- do not build freeform chart authoring or WebRTC in the first pass

## Recommended Rollout

### V1

- lobby pairing
- locked phone lanes
- host cue track
- tap input
- host scoring/audio
- optional auto-support for missing lanes

### V1.1

- motion accent
- hold cues for keys
- richer per-lane diagnostics

### V2

- multiple Jam Hero tracks
- richer instrument-specific phone gestures
- chart authoring and difficulty variants
