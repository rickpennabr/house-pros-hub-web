import Image from 'next/image';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  /** On viewports &lt; md, show this image instead of the default logo */
  mobileSrc?: string;
}

export default function Logo({ className = '', width = 200, height = 50, mobileSrc }: LogoProps) {
  const defaultSrc = '/thepros/hph-logo-with-pro-bot.png';
  if (mobileSrc) {
    return (
      <>
        <Image
          src={mobileSrc}
          alt="House Pros Hub Logo"
          width={width}
          height={height}
          className={`${className} md:hidden`}
          priority
        />
        <Image
          src={defaultSrc}
          alt="House Pros Hub Logo"
          width={width}
          height={height}
          className={`${className} hidden md:block`}
          priority
        />
      </>
    );
  }
  return (
    <Image
      src={defaultSrc}
      alt="House Pros Hub Logo"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

