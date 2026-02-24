import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraView } from './CameraView';

describe('CameraView', () => {
  const trackStop = vi.fn();
  const fakeStream = {
    getTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;

  beforeEach(() => {
    trackStop.mockReset();
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(fakeStream),
      },
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      writable: true,
      value: null,
    });

    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests webcam when running and stops tracks when stopped', async () => {
    const { rerender, unmount } = render(<CameraView isRunning={true} />);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    rerender(<CameraView isRunning={false} />);

    await waitFor(() => {
      expect(trackStop).toHaveBeenCalledTimes(1);
    });

    act(() => {
      unmount();
    });

    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});
