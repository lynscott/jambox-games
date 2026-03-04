import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import type { TimingGrade, ZoneId } from '../../types';

interface CalloutEntry {
  id: number;
  grade: TimingGrade;
  zone: ZoneId;
  timestamp: number;
}

const CALLOUT_DURATION_MS = 600;

// X position as percentage for each lane
const ZONE_X: Record<ZoneId, string> = {
  left: '16.7%',
  middle: '50%',
  right: '83.3%',
};

let nextId = 0;

export function TimingCallout() {
  const lanes = useAppStore((s) => s.lanes);
  const [callouts, setCallouts] = useState<CalloutEntry[]>([]);

  // Watch for grade changes
  useEffect(() => {
    const zones: ZoneId[] = ['left', 'middle', 'right'];
    zones.forEach((zone) => {
      const grade = lanes[zone].lastGrade;
      if (grade && grade !== 'miss') {
        const entry: CalloutEntry = {
          id: nextId++,
          grade,
          zone,
          timestamp: Date.now(),
        };
        setCallouts((prev) => [...prev, entry]);
      }
    });
  }, [lanes.left.lastGrade, lanes.middle.lastGrade, lanes.right.lastGrade, lanes.left.hitCount, lanes.middle.hitCount, lanes.right.hitCount]);

  // Cleanup expired callouts
  useEffect(() => {
    if (callouts.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setCallouts((prev) => prev.filter((c) => now - c.timestamp < CALLOUT_DURATION_MS));
    }, CALLOUT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [callouts]);

  return (
    <div className="timing-callout-layer">
      {callouts.map((c) => (
        <div
          key={c.id}
          className={`timing-callout timing-callout--${c.grade}`}
          style={{
            left: ZONE_X[c.zone],
            top: '45%',
            transform: 'translateX(-50%)',
          }}
        >
          {c.grade.toUpperCase()}
        </div>
      ))}
    </div>
  );
}
