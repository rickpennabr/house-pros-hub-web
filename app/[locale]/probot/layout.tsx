'use client';

import { ReactNode, useState, useEffect } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import ContractorPushButton from '@/components/probot/ContractorPushButton';
import ProBotNevadaMountains from '@/components/probot/ProBotNevadaMountains';
import { ChatProvider } from '@/contexts/ChatContext';
import { ProBotHeaderProvider, useProBotHeader } from '@/contexts/ProBotHeaderContext';
import { useProBotTransition } from '@/contexts/ProBotTransitionContext';
import { useAuth } from '@/contexts/AuthContext';
import { PROBOT_ASSETS } from '@/lib/constants/probot';

const SHRINK_DURATION_MS = 500;
/** Entrance scale animation: shorter so we spend less time on the black background. */
const ENTRANCE_SCALE_DURATION_MS = 200;
/** Minimum time to show the loading screen so it's visible. */
const LOADING_SCREEN_MIN_MS = 800;
/** How long each loading GIF is shown before switching to the other (first → second → first → …). */
const LOADING_GIF_INTERVAL_MS = 2000;

const LOADING_GIF_SRCS = ['/dance.gif', '/dance-1.gif'] as const;
const EMERGING_FROM_PROBOT_KEY = 'emergingFromProbot';
/** Header avatar: show waving GIF for this long, then switch to typing GIF. */
const HEADER_WAVING_DURATION_MS = 3000;

interface ProBotLayoutProps {
  children: ReactNode;
}

export default function ProBotLayout({ children }: ProBotLayoutProps) {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Simulate slow load: ?slowloading=5 keeps the loading screen for 5 seconds (for testing).
  const slowLoadingSec = searchParams.get('slowloading');
  const loadingMinMs =
    slowLoadingSec != null && slowLoadingSec !== ''
      ? Math.max(1000, parseInt(slowLoadingSec, 10) * 1000) || LOADING_SCREEN_MIN_MS
      : LOADING_SCREEN_MIN_MS;
  const { setTransitioningToProbot } = useProBotTransition();
  const { user } = useAuth();
  const isContractor = !!user?.businessId;
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  /** Header avatar: 0 = waving (first), 1 = typing (second). Sequence one after the other. */
  const [headerAvatarPhase, setHeaderAvatarPhase] = useState(0);
  const [headerImageLoaded, setHeaderImageLoaded] = useState(false);
  const [headerImageError, setHeaderImageError] = useState(false);
  const [viewportH, setViewportH] = useState<number | null>(null);
  /** Which loading GIF to show: 0 = dance.gif, 1 = dance-1.gif; alternates until page loads or error. */
  const [loadingGifIndex, setLoadingGifIndex] = useState(0);
  /** When true, GIF failed to load (e.g. no internet); stop alternating and show message. */
  const [loadingGifError, setLoadingGifError] = useState(false);

  // Set viewport height after mount (visual viewport for keyboard/resize). Avoids hydration mismatch (server has no window).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const update = () => setViewportH(vv ? vv.height : window.innerHeight);
    update();
    vv?.addEventListener('resize', update);
    return () => vv?.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setHeaderAvatarPhase(1), HEADER_WAVING_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  // Alternate loading GIF: first → second → first → … every LOADING_GIF_INTERVAL_MS until page reveals or error.
  useEffect(() => {
    if (revealed || exiting || loadingGifError) return;
    const id = setInterval(() => {
      setLoadingGifIndex((i) => (i === 0 ? 1 : 0));
    }, LOADING_GIF_INTERVAL_MS);
    return () => clearInterval(id);
  }, [revealed, exiting, loadingGifError]);

  // Show loading screen for at least loadingMinMs (or longer if ?slowloading=N), then reveal white card.
  useEffect(() => {
    let timeoutReveal: ReturnType<typeof setTimeout>;
    let timeoutTransition: ReturnType<typeof setTimeout>;
    timeoutReveal = setTimeout(() => {
      setRevealed(true);
      timeoutTransition = setTimeout(() => {
        setTransitioningToProbot(false);
      }, ENTRANCE_SCALE_DURATION_MS);
    }, loadingMinMs);
    return () => {
      clearTimeout(timeoutReveal);
      clearTimeout(timeoutTransition);
    };
  }, [setTransitioningToProbot, loadingMinMs]);

  return (
    <ChatProvider>
      <ProBotHeaderProvider>
        <ProBotLayoutContent
          locale={locale}
          router={router}
          loadingMinMs={loadingMinMs}
          setTransitioningToProbot={setTransitioningToProbot}
          isContractor={isContractor}
          revealed={revealed}
          exiting={exiting}
          setExiting={setExiting}
          headerAvatarPhase={headerAvatarPhase}
          headerImageLoaded={headerImageLoaded}
          headerImageError={headerImageError}
          setHeaderImageLoaded={setHeaderImageLoaded}
          setHeaderImageError={setHeaderImageError}
          loadingGifIndex={loadingGifIndex}
          loadingGifError={loadingGifError}
          setLoadingGifError={setLoadingGifError}
          viewportH={viewportH}
        >
          {children}
        </ProBotLayoutContent>
      </ProBotHeaderProvider>
    </ChatProvider>
  );
}

interface ProBotLayoutContentProps {
  children: ReactNode;
  locale: string;
  router: ReturnType<typeof useRouter>;
  loadingMinMs: number;
  setTransitioningToProbot: (v: boolean) => void;
  isContractor: boolean;
  revealed: boolean;
  exiting: boolean;
  setExiting: (v: boolean) => void;
  headerAvatarPhase: number;
  headerImageLoaded: boolean;
  headerImageError: boolean;
  setHeaderImageLoaded: (v: boolean) => void;
  setHeaderImageError: (v: boolean) => void;
  loadingGifIndex: number;
  loadingGifError: boolean;
  setLoadingGifError: (v: boolean) => void;
  viewportH: number | null;
}

function ProBotLayoutContent({
  children,
  locale,
  router,
  loadingMinMs,
  setTransitioningToProbot,
  isContractor,
  revealed,
  exiting,
  setExiting,
  headerAvatarPhase,
  headerImageLoaded,
  headerImageError,
  setHeaderImageLoaded,
  setHeaderImageError,
  loadingGifIndex,
  loadingGifError,
  setLoadingGifError,
  viewportH,
}: ProBotLayoutContentProps) {
  const t = useTranslations('probot');
  const { inChat, onBackToWelcome } = useProBotHeader();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const showBackChevron = isMobile && inChat;

  return (
    <>
      {/* Full viewport: day/night sky (continuation of chat area) + Nevada mountains */}
      <div
        className="fixed inset-0 min-h-screen h-screen min-h-[100dvh] h-[100dvh] w-full overflow-hidden flex flex-col pt-2 box-border relative probot-sky-bg"
        style={viewportH != null ? { height: `${viewportH}px` } : { height: '100svh' }}
      >
        <ProBotNevadaMountains />
        {/* Loading screen: one GIF at a time, alternating dance → dance-1 → dance → … until page loads or load error */}
        {!revealed && !exiting && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 probot-page-content-pc-transparent" aria-live="polite" aria-label="Loading page">
            <div className="flex flex-col items-center justify-center min-h-[120px] md:min-h-[140px]">
              {loadingGifError ? (
                <Image
                  src="/hph-bot-nonet.png"
                  alt=""
                  width={120}
                  height={120}
                  className="w-[100px] h-[100px] md:w-[120px] md:h-[120px] object-contain"
                />
              ) : (
                <Image
                  key={loadingGifIndex}
                  src={LOADING_GIF_SRCS[loadingGifIndex]}
                  alt=""
                  width={120}
                  height={120}
                  className="w-[100px] h-[100px] md:w-[120px] md:h-[120px] object-contain"
                  unoptimized
                  onError={() => setLoadingGifError(true)}
                />
              )}
            </div>
            <p className="text-white font-medium text-lg md:text-xl drop-shadow-md probot-night-text">
              {loadingGifError ? 'No internet' : 'Loading the page'}
            </p>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col w-full items-center justify-center relative z-10 probot-page-content-pc-transparent">
          <div
            className={`w-full max-w-[960px] flex-1 min-h-0 mx-auto border-2 border-black md:border-r-0 bg-white md:bg-transparent shadow-lg md:shadow-none rounded-lg overflow-hidden flex flex-col transition-transform ease-out origin-center ${
              revealed && !exiting ? 'scale-100' : 'scale-0'
            }`}
            style={{ transitionDuration: exiting ? `${SHRINK_DURATION_MS}ms` : `${ENTRANCE_SCALE_DURATION_MS}ms` }}
          >
            <header className="w-full h-[60px] shrink-0 border-b-2 border-r-2 border-black p-2 md:px-2 md:py-4 bg-white">
            <div className="relative w-full h-full flex items-center justify-between gap-2">
              {/* Left: on mobile when in chat show back chevron to ProBot welcome; otherwise HPH logo to home */}
              <div className="flex items-center flex-shrink-0 z-10">
                {showBackChevron ? (
                  <button
                    type="button"
                    onClick={onBackToWelcome}
                    className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    aria-label={t('backToWelcome')}
                  >
                    <ChevronLeft className="w-5 h-5 text-black" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (exiting) return;
                      setExiting(true);
                      if (typeof window !== 'undefined') window.sessionStorage.setItem(EMERGING_FROM_PROBOT_KEY, '1');
                      setTimeout(() => {
                        router.push(`/${locale}/businesslist`);
                      }, SHRINK_DURATION_MS);
                    }}
                    className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
                    aria-label="Go to home page"
                  >
                    <Image
                      src="/house-pros-hub-logo-simble-bot.png"
                      alt="House Pros Hub"
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                      priority
                    />
                  </button>
                )}
              </div>

              {/* Center: ProBot image + label (waving GIF first, then typing GIF). Show static avatar until GIF loads to avoid broken-image "?" on mobile. */}
              <div className="flex items-center justify-center gap-2 flex-1 min-w-0 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-100 relative">
                  {/* Static fallback: visible until GIF loads (or on error) */}
                  <Image
                    src={PROBOT_ASSETS.avatar}
                    alt=""
                    width={48}
                    height={48}
                    className={`w-full h-full object-contain ${headerImageLoaded && !headerImageError ? 'absolute opacity-0' : ''}`}
                    aria-hidden={headerImageLoaded && !headerImageError}
                  />
                  {/* Animated GIF: loads in background, shown when ready */}
                  <Image
                    src={headerAvatarPhase === 0 ? PROBOT_ASSETS.avatarHeader : PROBOT_ASSETS.avatarHeaderSecond}
                    alt="ProBot"
                    width={48}
                    height={48}
                    className={`w-full h-full object-contain ${headerImageLoaded && !headerImageError ? '' : 'absolute opacity-0'}`}
                    onLoad={() => setHeaderImageLoaded(true)}
                    onError={() => setHeaderImageError(true)}
                  />
                </div>
                <span className="text-base md:text-lg font-bold text-black whitespace-nowrap">
                  ProBot
                </span>
              </div>

              {/* Right: Contractor push (when applicable) + Profile Icon */}
              <div className="flex items-center gap-2 flex-shrink-0 z-[100]">
                {isContractor && <ContractorPushButton />}
                <ProfileIcon />
              </div>
            </div>
            </header>

            {/* Content area: no scroll here so chat input stays at bottom; only the messages region scrolls inside ProBotChatArea */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden probot-page-content-pc-transparent">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
