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

/**
 * Real pixel size of each logo file. next/image reads width and height as the aspect
 * ratio, not as the rendered size — CSS does the sizing. The wide header logo and the
 * square mobile mark differ enough that one shared pair makes next/image warn that the
 * image was stretched.
 */
const INTRINSIC_SIZES: Record<string, { width: number; height: number }> = {
  '/thepros/hph-logo-with-pro-bot.png': { width: 3132, height: 791 },
  '/hph-logo-with-pro-bot-mobile.png': { width: 3132, height: 581 },
  '/hph-logo-with-pro-bot-wt.png': { width: 3132, height: 581 },
  '/hph-logo-simble-bot-v1.png': { width: 760, height: 674 },
  '/houseproshub_logo.png': { width: 848, height: 839 },
};

export default function Logo({ className = '', width = 200, height = 50, src: unifiedSrc, mobileSrc, mobileDarkSrc, desktopDarkSrc }: LogoProps) {
  const defaultSrc = '/thepros/hph-logo-with-pro-bot.png';
  const defaultMobileSrc = '/hph-logo-simble-bot-v1.png';
  const effectiveMobileSrc = mobileSrc ?? defaultMobileSrc;
  const sizeOf = (src: string) => INTRINSIC_SIZES[src] ?? { width, height };

  if (unifiedSrc) {
    return (
      <Image
        src={unifiedSrc}
        alt="House Pros Hub Logo"
        {...sizeOf(unifiedSrc)}
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
          className={`logo-mobile-wrap md:hidden relative inline-flex min-w-0 max-w-full items-center justify-center ${className}`}
          style={{ height: '40px', width: '100%', minWidth: 0 }}
        >
          <Image
            src={effectiveMobileSrc}
            alt="House Pros Hub Logo"
            {...sizeOf(effectiveMobileSrc)}
            className={`${className} logo-mobile-default relative h-full w-full max-w-full object-contain object-center`}
            style={{ width: '100%', height: '40px', objectFit: 'contain' }}
            priority
          />
          {mobileDarkSrc && (
            <Image
              src={mobileDarkSrc}
              alt="House Pros Hub Logo"
              {...sizeOf(mobileDarkSrc)}
              className={`${className} logo-mobile-dark absolute inset-0 h-full w-full max-w-full object-contain object-center`}
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
              {...sizeOf(defaultSrc)}
              className={`${className} logo-desktop-default absolute inset-0 h-full w-auto object-contain object-left`}
              priority
            />
            <Image
              src={desktopDarkSrc}
              alt="House Pros Hub Logo"
              {...sizeOf(desktopDarkSrc)}
              className={`${className} logo-desktop-dark absolute inset-0 h-full w-auto object-contain object-left`}
              priority
            />
          </span>
        ) : (
          <Image
            src={defaultSrc}
            alt="House Pros Hub Logo"
            {...sizeOf(defaultSrc)}
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
      {...sizeOf(defaultSrc)}
      className={className}
      priority
    />
  );
}

