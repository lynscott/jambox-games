import type { ZoneId } from '../types';

const BEATS_PER_BAR = 4;
const BARS_PER_CYCLE = 8;
const HARMONY_BARS = 4;
const SOLO_BARS = 2;
const SOLO_ROTATION: ZoneId[] = ['left', 'middle', 'right'];
const ROLE_UP_NEXT_WINDOW_BEATS = BEATS_PER_BAR;

export type ArrangementSection = 'harmony' | 'solo' | 'blend';
export type LaneRoleState = 'play' | 'wait' | 'up_next';

export interface LoopArrangement {
  cycleIndex: number;
  barInCycle: number;
  beatInBar: number;
  cycleProgress: number;
  section: ArrangementSection;
  nextSection: ArrangementSection;
  cycleSoloZone: ZoneId;
  focusZone: ZoneId | null;
  activeZones: Record<ZoneId, boolean>;
  roleStates: Record<ZoneId, LaneRoleState>;
  beatsUntilTransition: number;
  callout: string;
  nextFocusZone: ZoneId | null;
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

function sectionCallout(section: ArrangementSection, focusZone: ZoneId | null): string {
  if (section === 'solo' && focusZone) {
    return `Solo: ${zoneLabel(focusZone)}`;
  }

  return section === 'harmony' ? 'Harmony' : 'Blend';
}

function sectionNextForBeat(section: ArrangementSection): ArrangementSection {
  if (section === 'harmony') {
    return 'solo';
  }

  if (section === 'solo') {
    return 'blend';
  }

  return 'harmony';
}

function sectionBeatStart(section: ArrangementSection): number {
  if (section === 'solo') {
    return HARMONY_BARS * BEATS_PER_BAR;
  }

  if (section === 'blend') {
    return (HARMONY_BARS + SOLO_BARS) * BEATS_PER_BAR;
  }

  return 0;
}

function beatsToNextSection(beatInCycle: number, section: ArrangementSection): number {
  if (section === 'blend') {
    return BEATS_PER_BAR * BARS_PER_CYCLE - beatInCycle;
  }

  return sectionBeatStart(sectionNextForBeat(section)) - beatInCycle;
}

function buildLaneRoles(
  section: ArrangementSection,
  focusZone: ZoneId,
  nextSection: ArrangementSection,
  nextFocusZone: ZoneId | null,
  beatsUntilTransition: number,
): { roleStates: Record<ZoneId, LaneRoleState>; activeZones: Record<ZoneId, boolean> } {
  const baseRoles: Record<ZoneId, LaneRoleState> = {
    left: 'wait',
    middle: 'wait',
    right: 'wait',
  };

  if (section === 'harmony' || section === 'blend') {
    Object.keys(baseRoles).forEach((zone) => {
      baseRoles[zone as ZoneId] = 'play';
    });
  } else {
    baseRoles[focusZone] = 'play';
  }

  if (
    nextSection === 'solo' &&
    nextFocusZone &&
    beatsUntilTransition > 0 &&
    beatsUntilTransition <= ROLE_UP_NEXT_WINDOW_BEATS
  ) {
    baseRoles[nextFocusZone] = 'up_next';
  }

  const activeZones: Record<ZoneId, boolean> = {
    left: baseRoles.left !== 'wait',
    middle: baseRoles.middle !== 'wait',
    right: baseRoles.right !== 'wait',
  };

  return { roleStates: baseRoles, activeZones };
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
  const nextSection = sectionNextForBeat(section);
  const focusZone = SOLO_ROTATION[cycleIndex % SOLO_ROTATION.length];
  const beatsUntilTransition = beatsToNextSection(beatInCycle, section);
  const nextFocusZone =
    nextSection === 'solo'
      ? SOLO_ROTATION[(cycleIndex + (section === 'blend' ? 1 : 0)) % SOLO_ROTATION.length]
      : null;
  const { roleStates, activeZones } = buildLaneRoles(
    section,
    focusZone,
    nextSection,
    nextFocusZone,
    beatsUntilTransition,
  );

  return {
    cycleIndex,
    barInCycle,
    beatInBar,
    cycleProgress,
    section,
    nextSection,
    cycleSoloZone: focusZone,
    focusZone: section === 'solo' ? focusZone : null,
    activeZones,
    roleStates,
    beatsUntilTransition,
    callout: sectionCallout(section, focusZone),
    nextFocusZone,
  };
}
