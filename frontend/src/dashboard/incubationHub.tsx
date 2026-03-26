import { ArrowLeft, Lightbulb, Users, Target, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const IncubationHub = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const incubationPrograms = [
    {
      title: "Accelerator Program",
      description: "3-month intensive program to launch your startup",
      icon: Zap,
      iconBg: "bg-[#7c3aed]",
      participants: "12 startups",
    },
    {
      title: "Mentorship Network",
      description: "Connect with experienced founders and industry experts",
      icon: Users,
      iconBg: "bg-[#38bdf8]",
      participants: "50+ mentors",
    },
    {
      title: "Funding Opportunities",
      description: "Access to seed funding and investor connections",
      icon: Target,
      iconBg: "bg-[#2dd4bf]",
      participants: "$5M available",
    },
    {
      title: "Resource Library",
      description: "Templates, guides, and tools for startup success",
      icon: Lightbulb,
      iconBg: "bg-[#f43f5e]",
      participants: "200+ resources",
    },
  ];

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleGoBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Incubation Hub
              </h1>
              <p className="text-sm text-muted-foreground">
                Nurture your ideas and accelerate your growth
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
          {/* Hero Section */}
          <section className="space-y-4">
            <div>
              <p className="text-lg text-muted-foreground max-w-3xl">
                Welcome to the TechIT Forge Incubation Hub. Here you'll find
                programs, resources, and connections to help transform your idea
                into a thriving startup.
              </p>
            </div>
          </section>

          {/* Programs Grid */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              Our Programs
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {incubationPrograms.map((program) => {
                const Icon = program.icon;
                return (
                  <div
                    key={program.title}
                    className="rounded-2xl bg-card/80 border border-border p-5 space-y-3 hover:border-[#38bdf8]/50 transition-all duration-300 group cursor-pointer"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${program.iconBg}`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">
                        {program.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {program.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {program.participants}
                      </span>
                      <span className="text-[#38bdf8] group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CTA Section */}
          <section className="rounded-2xl bg-gradient-to-r from-[#7c3aed]/10 to-[#38bdf8]/10 border border-[#7c3aed]/30 p-8 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Ready to launch your startup?
              </h2>
              <p className="text-muted-foreground">
                Join our community of innovators and get access to mentorship,
                funding, and resources to make your vision a reality.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#38bdf8] hover:bg-[#0ea5e9] transition-all duration-300 font-medium text-white shadow-lg">
                Get Started
              </button>
              <button className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-card border border-border hover:border-[#38bdf8]/50 transition-all duration-300 font-medium text-foreground">
                Learn More
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default IncubationHub;
