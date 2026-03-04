import { describe, expect, it, vi } from 'vitest';
import type { TransportController } from './transport';
import type { GarageBandInstruments } from './instruments';
import { createBackingTrackScheduler, syncBackingTrackPlayback } from './backing-track';
import { MIDNIGHT_SOUL_TRACK } from './tracks';

function createTransportDouble() {
  let callback: ((time: number) => void) | null = null;
  let interval: string | null = null;
  let startAt = 0;
  const clear = vi.fn();

  const transport: TransportController = {
    now: () => 0,
    start: async () => {},
    stop: () => {},
    setBpm: () => {},
    scheduleRepeat: (nextCallback, nextInterval, nextStartAtSeconds = 0) => {
      callback = nextCallback;
      interval = nextInterval;
      startAt = nextStartAtSeconds;
      return 11;
    },
    clear,
    schedule: () => 0,
  };

  return {
    transport,
    clear,
    getCallback: () => callback,
    getInterval: () => interval,
    getStartAt: () => startAt,
  };
}

function createInstrumentsDouble(): GarageBandInstruments {
  return {
    triggerKick: vi.fn(),
    triggerSnare: vi.fn(),
    triggerHat: vi.fn(),
    triggerBass: vi.fn(),
    triggerPad: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('backing track scheduler', () => {
  it('schedules the Midnight Soul groove on deterministic 8th-note steps', () => {
    const transportDouble = createTransportDouble();
    const instruments = createInstrumentsDouble();
    const groove = createBackingTrackScheduler({
      track: MIDNIGHT_SOUL_TRACK,
      transport: transportDouble.transport,
      instruments,
    });

    const eventId = groove.start(1.25);

    expect(eventId).toBe(11);
    expect(transportDouble.getInterval()).toBe('8n');
    expect(transportDouble.getStartAt()).toBe(1.25);

    const callback = transportDouble.getCallback();
    expect(callback).not.toBeNull();
    if (!callback) {
      return;
    }

    callback(1.25); // step 0
    callback(1.50); // step 1
    callback(1.75); // step 2
    callback(2.00); // step 3
    callback(2.25); // step 4
    callback(2.50); // step 5
    callback(2.75); // step 6
    callback(3.00); // step 7

    expect(instruments.triggerKick).toHaveBeenCalledTimes(2);
    expect(instruments.triggerSnare).toHaveBeenCalledTimes(1);
    expect(instruments.triggerHat).toHaveBeenCalledTimes(2);
    expect(instruments.triggerBass).toHaveBeenCalledTimes(2);
    expect(instruments.triggerPad).toHaveBeenCalledTimes(1);
    expect(instruments.triggerBass).toHaveBeenCalledWith('A2', 1.25, expect.any(Number));
  });

  it('advances chord content across bars and clears the repeat when stopped', () => {
    const transportDouble = createTransportDouble();
    const instruments = createInstrumentsDouble();
    const groove = createBackingTrackScheduler({
      track: MIDNIGHT_SOUL_TRACK,
      transport: transportDouble.transport,
      instruments,
    });

    groove.start(0);
    const callback = transportDouble.getCallback();
    expect(callback).not.toBeNull();
    if (!callback) {
      return;
    }

    for (let index = 0; index < 9; index += 1) {
      callback(index * 0.25);
    }

    expect(instruments.triggerPad).toHaveBeenNthCalledWith(
      2,
      ['F4', 'A4', 'C5'],
      2,
      expect.any(Number),
      expect.any(Number),
    );

    groove.stop();
    expect(transportDouble.clear).toHaveBeenCalledWith(11);
    expect(groove.isRunning()).toBe(false);
  });

  it('starts and stops playback based on the desired run state without double-starting', () => {
    const scheduler = {
      start: vi.fn(() => 23),
      stop: vi.fn(),
      isRunning: vi.fn(() => false),
    };

    syncBackingTrackPlayback({
      scheduler,
      shouldRun: true,
      startAtSeconds: 1.5,
    });

    expect(scheduler.start).toHaveBeenCalledWith(1.5);
    expect(scheduler.stop).not.toHaveBeenCalled();

    scheduler.isRunning.mockReturnValue(true);
    syncBackingTrackPlayback({
      scheduler,
      shouldRun: true,
      startAtSeconds: 2,
    });
    expect(scheduler.start).toHaveBeenCalledTimes(1);

    syncBackingTrackPlayback({
      scheduler,
      shouldRun: false,
      startAtSeconds: 2.5,
    });
    expect(scheduler.stop).toHaveBeenCalledTimes(1);
  });
});
