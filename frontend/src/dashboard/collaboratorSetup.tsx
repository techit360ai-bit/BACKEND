import NavBar from "@/components/ui/NavBar"
import { Button } from "@/components/ui/button"
import CelebrationOverlay from "@/components/CelebrationOverlay"
import { useEffect, useState } from "react"
import { useLocation, useNavigate, type Location } from "react-router-dom"

const collaboratorSkills = [
  "React",
  "Node.js",
  "Python",
  "Design",
  "Marketing",
  "Sales",
  "Product",
  "Data Science",
] as const

const minHours = 5
const maxHours = 60

type RiskTolerance = "Low" | "Medium" | "High"

type CollaboratorProfile = {
  skills: string[]
  hours: number
  riskTolerance: RiskTolerance
}

type CollaboratorLocationState = {
  celebrate?: boolean
  profile?: CollaboratorProfile
}

const CollaboratorSetup = () => {
  const location = useLocation() as Location & { state?: CollaboratorLocationState }
  const navigate = useNavigate()
  const initialProfile = location.state?.profile
  const [showArrivalCelebration, setShowArrivalCelebration] = useState(
    Boolean(location.state?.celebrate),
  )
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    initialProfile?.skills ?? ["React", "Node.js"],
  )
  const [hours, setHours] = useState(initialProfile?.hours ?? 20)
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance | null>(
    initialProfile?.riskTolerance ?? "Medium",
  )

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    )
  }

  const profileStrength = (() => {
    let score = 0
    if (selectedSkills.length > 0) score += 40
    if (hours >= minHours) score += 30
    if (riskTolerance) score += 30
    return score
  })()

  const isValid = selectedSkills.length > 0 && hours >= minHours && !!riskTolerance

  useEffect(() => {
    if (!showArrivalCelebration) return
    const timer = setTimeout(() => setShowArrivalCelebration(false), 700)
    return () => clearTimeout(timer)
  }, [showArrivalCelebration])

  const handleContinue = () => {
    if (!isValid || !riskTolerance) return
    const profile: CollaboratorProfile = {
      skills: selectedSkills,
      hours,
      riskTolerance,
    }
    navigate("/collaborator/summary", { state: { profile } })
  }

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <NavBar />
      <main className="flex-1 flex justify-center px-6 py-10 lg:py-16 relative overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-[#020617] dark:via-[#020617] dark:to-[#020617] text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(120,80,200,0.06)_0%,transparent_70%)]" />

        <div className="relative z-10 w-full max-w-5xl flex flex-col gap-8">
          <header className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold text-foreground">
              Set Up Your Profile
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Tell us about yourself to get matched with the right opportunities.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-900/80 dark:bg-slate-900/90 border border-slate-700 px-6 py-5 shadow-xl shadow-black/40">
                <p className="text-xs font-medium tracking-wide text-slate-300 mb-3">
                  Your Skills
                  <span className="ml-1 text-[0.7rem] font-normal text-slate-400">
                    (AI will suggest more)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {collaboratorSkills.map((skill) => {
                    const selected = selectedSkills.includes(skill)
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs sm:text-sm transition-colors",
                          selected
                            ? "border-sky-400 bg-sky-500/20 text-sky-100"
                            : "border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80",
                        ].join(" ")}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/80 dark:bg-slate-900/90 border border-slate-700 px-6 py-5 shadow-xl shadow-black/40 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-slate-300">
                      Weekly Availability
                      <span className="ml-1 text-[0.7rem] text-sky-400 font-normal">
                        {hours}h/week
                      </span>
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <input
                    type="range"
                    min={minHours}
                    max={maxHours}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                  <div className="flex justify-between text-[0.7rem] text-slate-400">
                    <span>Part-time</span>
                    <span>Full-time</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/80 dark:bg-slate-900/90 border border-slate-700 px-6 py-5 shadow-xl shadow-black/40 space-y-4">
                <p className="text-xs font-medium tracking-wide text-slate-300">
                  Risk Tolerance
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {(["Low", "Medium", "High"] as RiskTolerance[]).map((level) => {
                    const selected = riskTolerance === level
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setRiskTolerance(level)}
                        className={[
                          "rounded-xl border px-3 py-2.5 bg-slate-900/80 text-slate-200 transition-colors",
                          selected
                            ? "border-sky-400 bg-slate-800 text-sky-100"
                            : "border-slate-700 hover:bg-slate-800",
                        ].join(" ")}
                      >
                        {level}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-700 px-5 py-4 shadow-xl shadow-black/40">
                <p className="text-xs font-semibold tracking-wide text-slate-300 mb-3 flex items-center justify-between">
                  AI Profile Analysis
                  <span className="text-[0.7rem] text-slate-400">Preview</span>
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Profile Strength</span>
                    <span className="font-semibold text-slate-100">
                      {profileStrength}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all"
                      style={{ width: `${profileStrength}%` }}
                    />
                  </div>
                  <p className="text-[0.75rem] text-slate-400">
                    Complete the steps on the left to improve your matching accuracy.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                disabled={!isValid}
                className="w-full h-11 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleContinue}
              >
                Continue
              </Button>
              <p className="text-[0.7rem] text-slate-400">
                You&apos;ll be able to review your answers before finalizing your profile.
              </p>
            </aside>
          </section>
        </div>
        <CelebrationOverlay
          visible={showArrivalCelebration}
          message="Welcome to your collaborator setup."
          label="Collaborator Journey"
        />
      </main>
    </div>
  )
}

export default CollaboratorSetup
