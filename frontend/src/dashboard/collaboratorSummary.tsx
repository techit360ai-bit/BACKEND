import NavBar from "@/components/ui/NavBar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect } from "react"
import { useLocation, useNavigate, type Location } from "react-router-dom"

type CollaboratorProfile = {
  skills: string[]
  hours: number
  riskTolerance: "Low" | "Medium" | "High"
}

type SummaryLocationState = {
  profile?: CollaboratorProfile
}

const initialsFromName = (name: string) => {
  const parts = name.trim().split(" ")
  if (!parts.length) return "DU"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const CollaboratorSummary = () => {
  const navigate = useNavigate()
  const location = useLocation() as Location & { state?: SummaryLocationState }
  const profile = location.state?.profile

  useEffect(() => {
    if (!profile) {
      navigate("/collaborator/setup", { replace: true })
    }
  }, [navigate, profile])

  if (!profile) return null

  const name = "Demo User"
  const initials = initialsFromName(name)

  const aiScoreBase = 70
  const aiScore =
    aiScoreBase +
    Math.min(20, profile.skills.length * 3) +
    (profile.riskTolerance === "High" ? 5 : profile.riskTolerance === "Medium" ? 2 : 0)

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <NavBar />
      <main className="flex-1 flex justify-center px-6 py-10 lg:py-16 relative overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-[#0b1120] dark:via-[#020617] dark:to-[#020617] text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.18)_0%,transparent_55%)]" />
        <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-8">
          <header className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
              <span className="text-white text-xl">✓</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-semibold text-foreground">
                Profile Complete!
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Here&apos;s your AI-generated profile summary based on what you shared.
              </p>
            </div>
          </header>

          <section className="w-full">
            <div className="rounded-3xl bg-card/90 border border-border px-6 py-6 sm:px-8 sm:py-7 shadow-2xl shadow-black/40 max-w-3xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#38bdf8] text-white font-semibold">
                    {initials}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-semibold text-foreground">
                        {name}
                      </h2>
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-sky-300 border border-sky-500/30">
                        Collaborator
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                      Experienced collaborator ready to join high-potential teams and contribute
                      hands-on with key skills.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-primary/10 border border-primary/30 px-4 py-3 text-left sm:text-right space-y-2 min-w-40">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                    AI Compatibility Score
                  </p>
                  <p className="text-2xl font-semibold text-primary">{aiScore}%</p>
                  <p className="text-[0.7rem] text-muted-foreground">Match Potential</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-2xl bg-muted/5 border border-border/60 px-4 py-3 space-y-1">
                  <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
                    Key Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-[#1e293b] text-xs text-[#e5e7eb] px-2 py-0.5"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/5 border border-border/60 px-4 py-3 space-y-1">
                  <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
                    Commitment
                  </p>
                  <p className="text-sm text-foreground">{profile.hours}h / week</p>
                </div>

                <div className="rounded-2xl bg-muted/5 border border-border/60 px-4 py-3 space-y-1">
                  <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
                    Risk Tolerance
                  </p>
                  <p className="text-sm text-foreground">{profile.riskTolerance}</p>
                </div>

                <div className="rounded-2xl bg-muted/5 border border-border/60 px-4 py-3 space-y-1">
                  <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
                    Collaboration Fit
                  </p>
                  <p className="text-sm text-foreground">
                    Best suited for teams seeking {profile.riskTolerance.toLowerCase()}-risk,
                    committed collaborators.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/5 border border-border/60 px-4 py-4 space-y-2">
                <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground">
                  AI Matching Requirements
                </p>
                <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>
                    Prioritizing roles that need{" "}
                    <span className="text-foreground font-medium">
                      {profile.skills.slice(0, 3).join(", ")}
                    </span>
                    .
                  </li>
                  <li>
                    Matching with teams that align with a{" "}
                    <span className="text-foreground font-medium">
                      {profile.riskTolerance.toLowerCase()}
                    </span>{" "}
                    risk profile.
                  </li>
                  <li>
                    Prefers collaborations requiring around{" "}
                    <span className="text-foreground font-medium">
                      {profile.hours}h/week
                    </span>{" "}
                    commitment.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="w-full max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="w-full sm:w-40"
              onClick={() => navigate("/collaborator/setup", { state: { profile } })}
            >
              Edit Profile
            </Button>
            <Button
              className={cn(
                "w-full sm:flex-1 h-11 text-sm font-semibold",
                "bg-linear-to-r from-[#22c55e] via-[#38bdf8] to-[#6366f1] text-white hover:brightness-110",
              )}
              onClick={() => navigate("/collaborator/dashboard")}
            >
              Enter Incubator
            </Button>
          </section>
        </div>
      </main>
    </div>
  )
}

export default CollaboratorSummary

