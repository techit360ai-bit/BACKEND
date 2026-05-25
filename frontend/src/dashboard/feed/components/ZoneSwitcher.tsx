export function ZoneSwitcher({ active, onChange }: { active: string; onChange: (zone: string) => void }) {
  const zones = ['Global Pulse', 'Your Tribe', 'Build Logs', 'Questions', 'Problems'];
  return (
    <div className="sticky top-14 bg-bg-surface border-b border-border-default h-12 flex items-center gap-6 px-6 overflow-x-auto z-40">
      {zones.map((zone) => (
        <button key={zone} onClick={() => onChange(zone)} className={`relative h-full text-sm font-medium transition-colors whitespace-nowrap ${active === zone ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
          {zone}
          {active === zone && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary"></div>}
          {zone === 'Global Pulse' && <div className="absolute top-2 right-0 w-1.5 h-1.5 bg-accent-primary rounded-full"></div>}
        </button>
      ))}
    </div>
  );
}
