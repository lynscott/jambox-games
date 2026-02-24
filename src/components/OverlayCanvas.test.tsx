import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawOverlayGuides, OverlayCanvas } from './OverlayCanvas';
import { render } from '@testing-library/react';

describe('drawOverlayGuides', () => {
  it('draws zone guides and beat indicators', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      clearRect: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;

    drawOverlayGuides(ctx, 900, 450, 0.4);

    expect((ctx.moveTo as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    expect((ctx.arc as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    expect((ctx.stroke as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
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
        clearRect: vi.fn(),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
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
