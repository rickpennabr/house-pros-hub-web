import Image from 'next/image';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export default function Logo({ className = '', width = 200, height = 50 }: LogoProps) {
  return (
    <Image
      src="/hph-logo-2.3.png"
      alt="House Pros Hub Logo"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

