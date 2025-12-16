'use client';

interface SuccessMessageProps {
  message: string;
  className?: string;
}

export function SuccessMessage({ message, className = '' }: SuccessMessageProps) {
  if (!message) return null;

  return (
    <div className={`mb-4 p-3 bg-green-50 border-2 border-green-500 rounded-lg text-green-700 text-sm ${className}`}>
      {message}
    </div>
  );
}

