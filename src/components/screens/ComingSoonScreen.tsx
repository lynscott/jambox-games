interface ComingSoonScreenProps {
  title: string;
  description: string;
  onBack: () => void;
}

export function ComingSoonScreen({ title, description, onBack }: ComingSoonScreenProps) {
  return (
    <section className="phase-screen coming-soon-screen" aria-label="Coming Soon Screen">
      <div className="phase-card coming-soon-card">
        <p className="phase-kicker">Jam Box Games</p>
        <h1 className="phase-title">{title}</h1>
        <p className="coming-soon-badge">Coming Soon</p>
        <p className="phase-copy">{description}</p>
        <p className="coming-soon-copy">
          This mode is reserved in the launcher and will get its own full gameplay flow next.
        </p>
        <button type="button" className="phase-cta" onClick={onBack}>
          Back To Menu
        </button>
      </div>
    </section>
  );
}
