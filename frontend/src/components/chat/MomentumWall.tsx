const MomentumWall = () => {
  return (
    <aside className="sticky top-4 right-0 w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          Your Momentum Wall
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full min-w-0 bg-gradient-to-b from-slate-900 to-slate-950 border border-border rounded-xl p-4 space-y-4">
        {/* Project Name */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white truncate">
            MediConnect Africa
          </h3>
          <span className="inline-block px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full">
            MVP
          </span>
        </div>

        {/* GSIS Score */}
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground/70">GSIS</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-orange-400">68</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
          <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
            <span className="text-green-400">↑</span> High Potential
          </p>
        </div>

        {/* Decay Factor */}
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground/70">Decay Factor</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-400">0.91</span>
            <span className="text-xs text-red-400">-9%</span>
          </div>
          <p className="text-xs text-muted-foreground">Last active 5 days ago</p>
        </div>

        {/* Stage Progress */}
        <div className="space-y-2 pt-4 border-t border-border">
          <div className="flex items-center justify-between min-w-0">
            <p className="text-sm text-muted-foreground/70 shrink-0">Stage Progress</p>
            <span className="text-xs text-orange-400 font-semibold shrink-0">
              42% to Beta
            </span>
          </div>
          <div className="w-full h-2 bg-card rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
              style={{ width: "42%" }}
            />
          </div>
        </div>

        {/* 30-Day Velocity */}
        <div className="space-y-3 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground/70">30-DAY VELOCITY</p>
          <div className="flex items-end justify-between h-12 gap-1 w-full min-w-0">
            <div className="flex-1 h-full bg-emerald-500 rounded min-w-0" />
            <div className="flex-1 h-full bg-yellow-500 rounded min-w-0" />
            <div className="flex-1 h-full bg-red-500 rounded min-w-0" />
            <div className="flex-1 h-full bg-emerald-500 rounded min-w-0" />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="text-emerald-400">↑</span> Week 4 recovery +12 GSIS
          </p>
        </div>

        {/* Next Milestone */}
        <div className="space-y-3 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground/70 uppercase font-semibold">
            Next Milestone
          </p>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">💎</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                First paying customer
              </p>
              <p className="text-xs text-muted-foreground">~14 days away</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            🟠 Platform estimate based on velocity
          </p>
        </div>
      </div>
    </aside>
  );
};

export default MomentumWall;
