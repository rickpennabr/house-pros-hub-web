import type { ReactNode } from 'react';

interface ChatCamFrameProps {
  children: ReactNode;
  /** Defaults to full width on phones and 30% narrower on desktop. */
  className?: string;
}

/** Chat pill with the camera outline light running around the black border. */
export function ChatCamFrame({ children, className = 'w-full md:mx-auto md:w-[70%]' }: ChatCamFrameProps) {
  return (
    <div className={`chat-cam-frame relative ${className}`}>
      {children}
      <span className="chat-cam-ring" aria-hidden>
        <span className="chat-cam-lights" />
      </span>
    </div>
  );
}
