import { useState } from 'react';
import { Controls } from '../Controls';
import { Diagnostics } from '../Diagnostics';

interface GearMenuProps {
  onToggleSession: () => void;
}

export function GearMenu({ onToggleSession }: GearMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="gear-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label="Dev controls"
        type="button"
      >
        {open ? '\u2715' : '\u2699'}
      </button>

      {open && (
        <div className="gear-panel">
          <Controls onToggleSession={onToggleSession} />
          <Diagnostics />
        </div>
      )}
    </>
  );
}
