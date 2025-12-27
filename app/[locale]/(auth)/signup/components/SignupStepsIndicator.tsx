'use client';

interface SignupStepsIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

export function SignupStepsIndicator({ currentStep, totalSteps, stepLabel }: SignupStepsIndicatorProps) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between pb-2 md:pb-0">
        {/* Progress Bar Label */}
        <span className="text-base font-bold text-black">
          {stepLabel}
        </span>
        {/* Progress Bar */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`h-1 md:h-3 w-8 rounded-sm transition-colors ${
                index + 1 <= currentStep ? 'bg-black' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

