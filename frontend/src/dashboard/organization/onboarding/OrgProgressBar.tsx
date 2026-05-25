interface OrgProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function OrgProgressBar({
  currentStep,
  totalSteps,
}: OrgProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-indigo-500 dark:text-indigo-400 font-semibold">
          {Math.round(progress)}% Complete
        </span>
      </div>
      <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
