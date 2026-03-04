import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawNeonOverlay, OverlayCanvas } from './OverlayCanvas';
import { render } from '@testing-library/react';

describe('drawNeonOverlay', () => {
  it('draws zone washes, dividers, and beat dots', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      shadowColor: '',
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D;

    const hitFlashes = { left: 0, middle: 0, right: 0 };
    drawNeonOverlay(
      ctx,
      900,
      450,
      0.4,
      true,
      { left: true, middle: true, right: true },
      hitFlashes,
      performance.now(),
    );

    // Zone washes: 3 fillRect calls for lane colors
    expect((ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    // Beat dots: 3 arc calls
    expect((ctx.arc as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    // Divider lines: 2 stroke calls
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });
});

describe('OverlayCanvas', () => {
  const drawSpy = vi.fn();

  beforeEach(() => {
    drawSpy.mockReset();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
          addColorStop: vi.fn(),
        }),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        shadowColor: '',
        shadowBlur: 0,
      }),
    });

    let frames = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      if (frames < 1) {
        frames += 1;
        callback(16);
      }
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call pose draw callback when disabled', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 640 });
    Object.defineProperty(video, 'videoHeight', { value: 360 });

    render(<OverlayCanvas video={video} enabled={false} onDraw={drawSpy} beatPhase={0.2} />);

    expect(drawSpy).not.toHaveBeenCalled();
  });
});
