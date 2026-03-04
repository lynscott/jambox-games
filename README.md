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
server/
  ws-lobby-server.mjs
```

## Setup

```bash
npm install
npm run ws:server
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

For phone pairing, open the same app URL on a phone on the same network and use the Setup screen pairing panel.

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

## Know Your Lyrics (MVP)

- Host flow: `Home -> Know Your Lyrics -> Start Lyrics Mode`
- Phone flow: pair phone, then speak each line shown in the phone controller while the host plays the instrumental.
- Scoring combines:
  - lyric overlap (token sequence match)
  - timing offset (spoken line time vs cue midpoint)

### Import Instrumentals + Timestamped Lyrics

This MVP includes a local importer for YouTube instrumentals and `.lrc` timestamp files.

1. Install `yt-dlp` on your machine.
2. Create an `.lrc` file with `[mm:ss.xx] lyric line` entries.
3. Run:

```bash
node server/import-lyrics-track.mjs \
  --youtube "https://www.youtube.com/watch?v=YOUR_VIDEO_ID" \
  --title "Song Title" \
  --artist "Artist Name" \
  --lrc "/absolute/or/relative/path/to/song.lrc"
```

The command downloads audio to `public/audio/lyrics/<track-id>.mp3` and injects the new track into `src/game/lyricsCatalog.generated.ts`.

### Live YouTube Song Browser

`Know Your Lyrics` now supports live YouTube instrumental browsing and search in the setup screen.

- Add `VITE_YOUTUBE_API_KEY` to your local env to enable YouTube search/top results.
- Song search uses YouTube Data API `search.list` plus `videos.list`.
- Lyrics are fetched on selection from `lyrics.ovh`, then split into blind scoring rounds automatically.

Example:

```bash
VITE_YOUTUBE_API_KEY=your_key_here
```

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

## WebSocket Lobby + Pairing

- `npm run dev` now starts both the Vite app server and the lobby WebSocket server together.
- The browser connects to the lobby over the same app origin at `/ws`, so phone pairing works over local network URLs and Cloudflare tunnels without exposing a second public port.
- In the app Setup screen, use **Lobby + Phone Pairing**:
  - Host/TV: connect, create a lobby, create one or more rooms.
  - Phone: connect, enter lobby code + room pair code, then pair.
- Override socket URL in frontend with `VITE_WS_URL` only if you need a custom endpoint.
- If you tunnel the app with Cloudflare, use the tunneled app URL on the phone. The `/ws` socket will ride the same origin automatically.

## Notes

- Conductor behavior is deterministic rule logic (no LLM calls).
