import Image from 'next/image';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  /** Use this single image for all viewports (e.g. auth pages). When set, mobile/desktop variants are ignored. */
  src?: string;
  /** On viewports < md, show this image instead of the default logo */
  mobileSrc?: string;
  /** On mobile in dark mode (system or dynamic sky), show this image instead of mobileSrc */
  mobileDarkSrc?: string;
  /** On desktop (PC) in dark mode (system or dynamic sky), show this image instead of default desktop logo */
  desktopDarkSrc?: string;
}

export default function Logo({ className = '', width = 200, height = 50, src: unifiedSrc, mobileSrc, mobileDarkSrc, desktopDarkSrc }: LogoProps) {
  const defaultSrc = '/thepros/hph-logo-with-pro-bot.png';
  const defaultMobileSrc = '/hph-logo-simble-bot-v1.png';
  const effectiveMobileSrc = mobileSrc ?? defaultMobileSrc;

  if (unifiedSrc) {
    return (
      <Image
        src={unifiedSrc}
        alt="House Pros Hub Logo"
        width={width}
        height={height}
        className={className}
        priority
      />
    );
  }

  if (effectiveMobileSrc) {
    return (
      <>
        {/* Mobile: height fixed (e.g. 40px from header); width from image so no fixed width */}
        <span
          className={`logo-mobile-wrap md:hidden inline-flex items-center justify-center relative ${className}`}
          style={{ height: '40px' }}
        >
          <Image
            src={effectiveMobileSrc}
            alt="House Pros Hub Logo"
            width={width}
            height={height}
            className={`${className} logo-mobile-default h-full w-auto object-contain object-left relative`}
            priority
          />
          {mobileDarkSrc && (
            <Image
              src={mobileDarkSrc}
              alt="House Pros Hub Logo"
              width={width}
              height={height}
              className={`${className} logo-mobile-dark relative h-full w-auto object-contain object-left`}
              priority
            />
          )}
        </span>
        {/* Desktop: default logo; when desktopDarkSrc set, stacked and CSS toggles on dark */}
        {desktopDarkSrc ? (
          <span
            className="logo-desktop-wrap hidden md:inline-block relative"
            style={{ width, height }}
          >
            <Image
              src={defaultSrc}
              alt="House Pros Hub Logo"
              width={width}
              height={height}
              className={`${className} logo-desktop-default absolute inset-0 h-full w-auto object-contain object-left`}
              priority
            />
            <Image
              src={desktopDarkSrc}
              alt="House Pros Hub Logo"
              width={width}
              height={height}
              className={`${className} logo-desktop-dark absolute inset-0 h-full w-auto object-contain object-left`}
              priority
            />
          </span>
        ) : (
          <Image
            src={defaultSrc}
            alt="House Pros Hub Logo"
            width={width}
            height={height}
            className={`${className} hidden md:block`}
            priority
          />
        )}
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

