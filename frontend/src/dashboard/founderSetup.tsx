import NavBar from "@/components/ui/NavBar"
import { Button } from "@/components/ui/button"
import CelebrationOverlay from "@/components/CelebrationOverlay"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useLocation, useNavigate, type Location } from "react-router-dom"

const startupStages = ["Idea", "MVP", "Launch", "Growth"] as const
const industries = [
  "AI/ML",
  "Fintech",
  "HealthTech",
  "E-Commerce",
  "SaaS",
  "Edtech",
  "CleanTech",
  "Web3",
] as const

const experienceLevels = [
  "First Time Founder",
  "Some Experience",
  "Serial Entrepreneur",
] as const

const minHours = 5
const maxHours = 60

type FounderProfile = {
  stage: string
  industries: string[]
  experience: string
  hours: number
}

type FounderLocationState = {
  celebrate?: boolean
  profile?: FounderProfile
}

const FounderSetup = () => {
  const location = useLocation() as Location & { state?: FounderLocationState }
  const navigate = useNavigate()
  const initialProfile = location.state?.profile
  const [showArrivalCelebration, setShowArrivalCelebration] = useState(
    Boolean(location.state?.celebrate),
  )
  const [stage, setStage] = useState<string | null>(initialProfile?.stage ?? "Idea")
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(
    initialProfile?.industries ?? ["AI/ML"],
  )
  const [experience, setExperience] = useState<string | null>(
    initialProfile?.experience ?? "First Time Founder",
  )
  const [hours, setHours] = useState(initialProfile?.hours ?? 30)

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((i) => i !== industry) : [...prev, industry],
    )
  }

  const profileStrength = (() => {
    let score = 0
    if (stage) score += 25
    if (selectedIndustries.length > 0) score += 25
    if (experience) score += 25
    if (hours >= minHours) score += 25
    return score
  })()

  const isValid =
    !!stage && selectedIndustries.length > 0 && !!experience && hours >= minHours

  useEffect(() => {
    if (!showArrivalCelebration) return
    const timer = setTimeout(() => setShowArrivalCelebration(false), 700)
    return () => clearTimeout(timer)
  }, [showArrivalCelebration])

  const handleContinue = () => {
    if (!isValid || !stage || !experience) return
    const profile: FounderProfile = {
      stage,
      industries: selectedIndustries,
      experience,
      hours,
    }
    navigate("/founder/summary", { state: { profile } })
  }

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <NavBar />
      <main className="flex-1 flex justify-center px-6 py-10 lg:py-16 relative overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-[#0f172a] dark:via-[#1e1b4b] dark:to-[#0f172a] text-foreground">
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
              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-xl shadow-black/30">
                <p className="text-xs font-medium tracking-wide text-muted-foreground mb-3">
                  STARTUP STAGE
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {startupStages.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStage(item)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-medium text-left bg-background/60 hover:bg-accent hover:text-accent-foreground transition-colors",
                        stage === item && "border-primary bg-primary/10 text-primary",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-xl shadow-black/30">
                <p className="text-xs font-medium tracking-wide text-muted-foreground mb-3">
                  INDUSTRY FOCUS
                  <span className="ml-1 text-[0.7rem] font-normal text-muted-foreground/80">
                    (select all that apply)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {industries.map((industry) => (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => toggleIndustry(industry)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs sm:text-sm text-muted-foreground bg-background/60 hover:bg-accent hover:text-accent-foreground transition-colors",
                        selectedIndustries.includes(industry) &&
                          "border-primary bg-primary/10 text-primary",
                      )}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-xl shadow-black/30 space-y-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  EXPERIENCE LEVEL
                </p>
                <div className="space-y-2">
                  {experienceLevels.map((level) => (
                    <label
                      key={level}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm cursor-pointer bg-background/60 hover:bg-accent/30 transition-colors",
                        experience === level && "border-primary bg-primary/10",
                      )}
                    >
                      <input
                        type="radio"
                        value={level}
                        checked={experience === level}
                        onChange={() => setExperience(level)}
                        className="size-4 accent-primary"
                      />
                      <span className="text-sm text-foreground">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-xl shadow-black/30 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                      TIME COMMITMENT
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      How much time can you dedicate each week?
                    </p>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {hours}h/week
                  </span>
                </div>
                <div className="space-y-1">
                  <input
                    type="range"
                    min={minHours}
                    max={maxHours}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[0.7rem] text-muted-foreground">
                    <span>Part-time</span>
                    <span>Full-time</span>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-card/80 border border-border px-5 py-4 shadow-xl shadow-black/30">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-3 flex items-center justify-between">
                  AI Profile Analysis
                  <span className="text-[0.7rem] text-muted-foreground/80">
                    Preview
                  </span>
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Profile Strength</span>
                    <span className="font-semibold text-foreground">{profileStrength}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${profileStrength}%` }}
                    />
                  </div>
                  <p className="text-[0.75rem] text-muted-foreground">
                    Complete the steps on the left to improve your matching accuracy.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                disabled={!isValid}
                className="w-full h-11 text-sm font-semibold"
                onClick={handleContinue}
              >
                Continue
              </Button>
              <p className="text-[0.7rem] text-muted-foreground">
                You&apos;ll be able to review your answers before finalizing your profile.
              </p>
            </aside>
          </section>
        </div>
        <CelebrationOverlay
          visible={showArrivalCelebration}
          message="Welcome to your founder setup."
          label="Founder Journey"
        />
      </main>
    </div>
  )
}

export default FounderSetup

