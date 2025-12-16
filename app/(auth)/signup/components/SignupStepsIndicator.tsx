'use client';

interface SignupStepsIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

export function SignupStepsIndicator({ currentStep, totalSteps, stepLabel }: SignupStepsIndicatorProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-bold text-black">
          {stepLabel}
        </span>
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
    </div>
  );
}

