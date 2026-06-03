import { useNavigate } from "react-router-dom";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-[#0f172a] dark:via-[#1e1b4b] dark:to-[#0f172a] text-foreground">
      {/* Subtle flecks/noise effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(120,80,200,0.06)_0%,transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full gap-8 text-center">
        {/* Icon */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#f43f5e]/10 border-2 border-[#f43f5e]/30">
          <AlertCircle className="h-12 w-12 text-[#f43f5e]" />
        </div>

        {/* Error Code */}
        <div>
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter mb-4">
            <span className="bg-linear-to-r from-[#f43f5e] to-[#e11d48] bg-clip-text text-transparent">
              404
            </span>
          </h1>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Page Not Found
          </p>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-3">
          <p className="text-lg text-muted-foreground max-w-lg">
            Oops! We couldn't find what you're looking for. The page you're
            trying to access doesn't exist or has been moved.
          </p>
          <p className="text-sm text-muted-foreground">
            Let's get you back on track with TechIT Forge.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-card/80 border border-border hover:bg-card/60 transition-all duration-300 font-medium text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#38bdf8] hover:bg-[#0ea5e9] transition-all duration-300 font-medium text-white shadow-lg hover:shadow-xl"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-border w-full">
          <p className="text-sm text-muted-foreground mb-4">
            Need help? Here are some useful links:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="/"
              className="px-4 py-2 rounded-lg bg-card/50 border border-border hover:border-[#38bdf8] hover:bg-card transition-all hover:text-[#38bdf8] text-sm text-muted-foreground"
            >
              Landing Page
            </a>
            <a
              href="/"
              className="px-4 py-2 rounded-lg bg-card/50 border border-border hover:border-[#38bdf8] hover:bg-card transition-all hover:text-[#38bdf8] text-sm text-muted-foreground"
            >
              Get Started
            </a>
            <a
              href="/"
              className="px-4 py-2 rounded-lg bg-card/50 border border-border hover:border-[#38bdf8] hover:bg-card transition-all hover:text-[#38bdf8] text-sm text-muted-foreground"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
