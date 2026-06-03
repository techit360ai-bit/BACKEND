type CelebrationOverlayProps = {
  visible: boolean
  message?: string
  label?: string
}

const confettiPieces = Array.from({ length: 18 })

const colors = [
  "bg-[#38bdf8]",
  "bg-[#a78bfa]",
  "bg-[#f97316]",
  "bg-[#22c55e]",
  "bg-[#ef4444]",
]

const CelebrationOverlay = ({ visible, message, label }: CelebrationOverlayProps) => {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />

      <div className="relative z-10 flex flex-col items-center gap-4 px-6">
        <div className="relative flex flex-col items-center gap-3 rounded-3xl bg-background/90 border border-border px-6 py-5 shadow-2xl shadow-black/40 backdrop-blur">
          <span className="text-xs font-semibold tracking-[0.2em] text-[#38bdf8] uppercase">
            {label ?? "Founder Journey"}
          </span>
          <p className="text-lg sm:text-xl font-semibold text-foreground text-center">
            {message ?? "You&apos;re starting your founder journey!"}
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            Matching you with the best opportunities for your startup profile.
          </p>
        </div>

        <div className="relative w-full max-w-xl h-32 overflow-hidden pointer-events-none">
          {confettiPieces.map((_, index) => {
            const color = colors[index % colors.length]
            const delay = index * 75
            const left = 5 + (index * 100) / confettiPieces.length

            return (
              <div
                key={index}
                className={`absolute top-[-10%] h-3 w-1.5 rounded-sm ${color} animate-in slide-in-from-top fade-in`}
                style={{
                  left: `${left}%`,
                  animationDuration: "900ms",
                  animationDelay: `${delay}ms`,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CelebrationOverlay

