import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraView, __resetCameraViewSharedStateForTests } from './CameraView';

describe('CameraView', () => {
  const trackStop = vi.fn();
  const fakeStream = {
    getTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;

  beforeEach(() => {
    vi.useFakeTimers();
    trackStop.mockReset();
    __resetCameraViewSharedStateForTests();
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
    __resetCameraViewSharedStateForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests webcam when running and stops tracks when stopped', async () => {
    const { rerender, unmount } = render(<CameraView isRunning={true} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    rerender(<CameraView isRunning={false} />);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(trackStop).toHaveBeenCalledTimes(1);

    act(() => {
      unmount();
    });

    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it('keeps the stream alive across rapid remount handoff', async () => {
    const first = render(<CameraView isRunning={true} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    act(() => {
      first.unmount();
    });

    const second = render(<CameraView isRunning={true} />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(trackStop).toHaveBeenCalledTimes(0);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    act(() => {
      second.unmount();
      vi.advanceTimersByTime(900);
    });

    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});
