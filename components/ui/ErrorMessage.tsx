'use client';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div className={`mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-sm ${className}`}>
      {message}
    </div>
  );
}

