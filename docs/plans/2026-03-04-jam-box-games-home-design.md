# Jam Box Games Home Design

**Date:** 2026-03-04

**Goal:** Add a branded home screen that acts as the front door for the app, presenting four equal game choices under the `Jam Box Games` brand while preserving the existing `Jam Hero` flow.

## Summary

The app will gain a new `home` phase that precedes the current `setup -> permissions -> calibration -> tutorial -> jam -> results` flow. The home screen will present four equal interactive game tiles in a 2x2 arcade launcher layout:

- `Jam Hero`
- `Vs.`
- `On Beat`
- `Know Your Lyrics`

`Jam Hero` will route directly into the existing setup flow. The other three entries will route to lightweight placeholder screens for now. Each tile will contain a stylized placeholder logo mark, short descriptive copy, and an availability chip.

## UX Goals

- Make the app feel like a game collection, not a single-mode prototype.
- Keep all four games visually equal on the home screen.
- Preserve the existing `Jam Hero` game loop with minimal risk.
- Make placeholder modes feel intentional rather than disabled.
- Reuse the existing neon-arcade visual language instead of introducing a separate design system.

## Architecture

The current app already uses a phase-based single-screen flow. That is the correct fit for this feature because only one game is playable today and the existing `Jam Hero` state machine is already tied to the current phase model.

The phase model will be extended with:

- `home`
- `vs_placeholder`
- `on_beat_placeholder`
- `lyrics_placeholder`

No router will be introduced. `Jam Hero` remains the only playable path and still enters the current setup screen directly.

## Screen Design

### Home Screen

The home screen should feel like an arcade launcher wall:

- brand hero section at the top for `Jam Box Games`
- four equal game tiles in a grid
- each tile includes:
  - stylized placeholder logo mark
  - title
  - one-line descriptor
  - status chip
  - subtle detail copy

Tile behaviors:

- `Jam Hero`: routes to `setup`
- `Vs.`: routes to `vs_placeholder`
- `On Beat`: routes to `on_beat_placeholder`
- `Know Your Lyrics`: routes to `lyrics_placeholder`

The provided `Jam Box Games` logo image will be treated as the visual reference for the home screen style. Since there is not yet a committed asset path for the logo in the repo, the implementation may use a stylized brand block that can be swapped for the real asset later without reworking the layout.

### Placeholder Screens

Each placeholder screen will reuse the existing full-screen phase card structure. It should communicate:

- game title
- short description of the future mode
- `Coming Soon` status
- `Back To Menu` action

No gameplay state should start from these screens.

## Content Direction

Recommended tile copy:

- `Jam Hero`: `Move to the groove. Build score with rhythm and consistency.`
- `Vs.`: `Face off in a fast musical showdown.`
- `On Beat`: `Lock into timing challenges and survive the tempo.`
- `Know Your Lyrics`: `Finish the line and prove your music memory.`

Recommended placeholder screen copy should stay short and game-like.

## Styling Direction

The screen should stay within the neon-arcade look already established:

- strong brand framing
- deep black surfaces
- saturated neon edges and glows
- expressive display typography
- hover lift and glow on game cards
- responsive 2x2 grid on desktop, 1-column stack on mobile

Each game tile should have its own accent treatment:

- `Jam Hero`: amber + cyan
- `Vs.`: magenta + red-orange
- `On Beat`: cyan + lime
- `Know Your Lyrics`: gold + violet

## Testing Strategy

Add tests for:

- home screen renders all four game options
- clicking `Jam Hero` transitions to setup
- clicking each placeholder game opens its placeholder screen
- placeholder screen back action returns to home

The existing `Jam Hero` screen flow should remain intact after entering from `home`.

## Risks

- The current setup screen is the app entry point today, so switching the default phase to `home` can affect existing assumptions in tests.
- The main logo asset is not currently committed in the repo, so the first pass should avoid coupling layout correctness to a missing image file.
- Adding launcher polish should not break the existing mobile-friendly phase card layout.
