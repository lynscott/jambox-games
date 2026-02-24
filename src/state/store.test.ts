import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(createInitialState());
  });

  it('loads default transport and conductor settings', () => {
    const state = useAppStore.getState();

    expect(state.bpm).toBe(110);
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
});
