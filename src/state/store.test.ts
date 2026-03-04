import { beforeEach, describe, expect, it } from 'vitest';
import { MIDNIGHT_SOUL_TRACK } from '../music/tracks';
import { createInitialState, useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });

  it('loads default transport and conductor settings', () => {
    const state = useAppStore.getState();

    expect(state.bpm).toBe(MIDNIGHT_SOUL_TRACK.bpm);
    expect(state.quantization).toBe('8n');
    expect(state.conductorEnabled).toBe(true);
  });

  it('updates bpm and quantization', () => {
    useAppStore.getState().setBpm(128);
    useAppStore.getState().setQuantization('16n');

    const state = useAppStore.getState();
    expect(state.bpm).toBe(128);
    expect(state.quantization).toBe('16n');
  });

  it('initializes lanes as unoccupied with a neutral gameplay status', () => {
    const state = useAppStore.getState();

    expect(state.lanes.left.occupied).toBe(false);
    expect(state.lanes.middle.occupied).toBe(false);
    expect(state.lanes.right.occupied).toBe(false);
    expect(state.lanes.left.status).toBe('no_player');
    expect(state.lanes.middle.status).toBe('no_player');
    expect(state.lanes.right.status).toBe('no_player');
  });
});
