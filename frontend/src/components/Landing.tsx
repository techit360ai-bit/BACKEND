import { useState } from "react";
import { Lightbulb, Users, Target, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from "@/components/ui/NavBar";
import CelebrationOverlay from "@/components/CelebrationOverlay";

const roles = [
  // founder, collaborator, investor and organization
  {
    title: "Founder",
    description: "Turn your idea into reality",
    icon: Lightbulb,
    iconBg: "bg-[#7c3aed]",
  },
  {
    title: "Collaborator",
    description: "Build the future together",
    icon: Users,
    iconBg: "bg-[#38bdf8]",
  },
  {
    title: "Investor",
    description: "Discover the next big thing",
    icon: Target,
    iconBg: "bg-[#2dd4bf]",
  },
  {
    title: "Organization",
    description: "Empower your team with innovation",
    icon: Users,
    iconBg: "bg-[#f43f5e]",
  },
];

const Landing = () => {
  const [showFounderCelebration, setShowFounderCelebration] = useState(false);
  const [showCollaboratorCelebration, setShowCollaboratorCelebration] =
    useState(false);
  const navigate = useNavigate();

  const handleFounderStart = () => {
    if (showFounderCelebration || showCollaboratorCelebration) return;
    setShowFounderCelebration(true);
    setTimeout(() => {
      navigate("/founder/setup", { state: { celebrate: true } });
      setShowFounderCelebration(false);
    }, 900);
  };

  const handleCollaboratorStart = () => {
    if (showCollaboratorCelebration || showFounderCelebration) return;
    setShowCollaboratorCelebration(true);
    setTimeout(() => {
      navigate("/collaborator/setup", { state: { celebrate: true } });
      setShowCollaboratorCelebration(false);
    }, 900);
  };

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-[#0f172a] dark:via-[#1e1b4b] dark:to-[#0f172a] text-foreground">
        {/* Subtle flecks/noise effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(120,80,200,0.06)_0%,transparent_70%)]" />

        <div className="relative z-10 flex flex-col items-center max-w-4xl w-full gap-16">
          {/* Hero Section */}
          <section className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#38bdf8]/90 shadow-lg">
              <Lightbulb className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              <span className="bg-linear-to-r from-[#a78bfa] via-[#38bdf8] to-[#a78bfa] bg-clip-text text-transparent">
                Build. Match. Launch.
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Join TechIT Forge to turn ideas into startups with AI-powered
              matching and collaboration.
            </p>
          </section>

          {/* Role Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
            {roles.map((role) => (
              <div
                key={role.title}
                className="group flex flex-col gap-4 rounded-2xl bg-card/80 backdrop-blur border border-border p-6 shadow-xl hover:bg-card transition-all duration-300"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-xl ${role.iconBg}`}
                >
                  <role.icon className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {role.title}
                </h2>
                <p className="text-muted-foreground text-sm flex-1">
                  {role.description}
                </p>
                {role.title === "Founder" ? (
                  <button
                    type="button"
                    onClick={handleFounderStart}
                    className="inline-flex items-center gap-1.5 text-[#38bdf8] font-medium hover:text-[#7dd3fc] transition-colors text-sm"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : role.title === "Collaborator" ? (
                  <button
                    type="button"
                    onClick={handleCollaboratorStart}
                    className="inline-flex items-center gap-1.5 text-[#38bdf8] font-medium hover:text-[#7dd3fc] transition-colors text-sm"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <Link
                    to="#"
                    className="inline-flex items-center gap-1.5 text-[#38bdf8] font-medium hover:text-[#7dd3fc] transition-colors text-sm"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))}
          </section>

          {/* Bottom Link */}
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors underline-offset-4 hover:underline"
          >
            Explore Platform Without Signing Up
          </a>

          <CelebrationOverlay
            visible={showFounderCelebration}
            message="You’re starting your founder journey!"
            label="Founder Journey"
          />
          <CelebrationOverlay
            visible={showCollaboratorCelebration}
            message="You’re starting your collaborator journey!"
            label="Collaborator Journey"
          />
        </div>
      </div>
    </div>
  );
};

export default Landing;
