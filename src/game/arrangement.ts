import type { ZoneId } from '../types';

const BEATS_PER_BAR = 4;
const BARS_PER_CYCLE = 8;
const HARMONY_BARS = 4;
const SOLO_BARS = 2;
const SOLO_ROTATION: ZoneId[] = ['left', 'middle', 'right'];

const FULL_ACTIVE: Record<ZoneId, boolean> = {
  left: true,
  middle: true,
  right: true,
};

export type ArrangementSection = 'harmony' | 'solo' | 'blend';

export interface LoopArrangement {
  cycleIndex: number;
  barInCycle: number;
  beatInBar: number;
  cycleProgress: number;
  section: ArrangementSection;
  cycleSoloZone: ZoneId;
  focusZone: ZoneId | null;
  activeZones: Record<ZoneId, boolean>;
  callout: string;
}

export interface ComputeLoopArrangementParams {
  nowSeconds: number;
  jamStartSeconds: number;
  bpm: number;
}

function sectionForBar(barInCycle: number): ArrangementSection {
  if (barInCycle < HARMONY_BARS) {
    return 'harmony';
  }

  if (barInCycle < HARMONY_BARS + SOLO_BARS) {
    return 'solo';
  }

  return 'blend';
}

function zoneLabel(zone: ZoneId): string {
  return zone.charAt(0).toUpperCase() + zone.slice(1);
}

export function computeLoopArrangement({ nowSeconds, jamStartSeconds, bpm }: ComputeLoopArrangementParams): LoopArrangement {
  const safeBpm = Math.max(1, bpm);
  const totalBeats = Math.max(0, ((nowSeconds - jamStartSeconds) * safeBpm) / 60);

  const beatsPerCycle = BEATS_PER_BAR * BARS_PER_CYCLE;
  const cycleIndex = Math.floor(totalBeats / beatsPerCycle);
  const beatInCycle = totalBeats - cycleIndex * beatsPerCycle;
  const barInCycle = Math.min(BARS_PER_CYCLE - 1, Math.floor(beatInCycle / BEATS_PER_BAR));
  const beatInBar = beatInCycle - barInCycle * BEATS_PER_BAR;
  const cycleProgress = beatInCycle / beatsPerCycle;

  const section = sectionForBar(barInCycle);
  const focusZone = SOLO_ROTATION[cycleIndex % SOLO_ROTATION.length];

  if (section === 'solo') {
    return {
      cycleIndex,
      barInCycle,
      beatInBar,
      cycleProgress,
      section,
      cycleSoloZone: focusZone,
      focusZone,
      activeZones: {
        left: focusZone === 'left',
        middle: focusZone === 'middle',
        right: focusZone === 'right',
      },
      callout: `Solo: ${zoneLabel(focusZone)}`,
    };
  }

  return {
    cycleIndex,
    barInCycle,
    beatInBar,
    cycleProgress,
    section,
    cycleSoloZone: focusZone,
    focusZone: null,
    activeZones: { ...FULL_ACTIVE },
    callout: section === 'harmony' ? 'Harmony' : 'Blend',
  };
}
