'use client';

import { ReactNode, useState, useEffect } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';
import ContractorPushButton from '@/components/probot/ContractorPushButton';
import { ChatProvider } from '@/contexts/ChatContext';
import { useProBotTransition } from '@/contexts/ProBotTransitionContext';
import { useAuth } from '@/contexts/AuthContext';
import { PROBOT_ASSETS } from '@/lib/constants/probot';

const SHRINK_DURATION_MS = 500;
/** Entrance scale animation: shorter so we spend less time on the black background. */
const ENTRANCE_SCALE_DURATION_MS = 200;
const EMERGING_FROM_PROBOT_KEY = 'emergingFromProbot';
/** Header avatar: show waving GIF for this long, then switch to typing GIF. */
const HEADER_WAVING_DURATION_MS = 3000;

interface ProBotLayoutProps {
  children: ReactNode;
}

export default function ProBotLayout({ children }: ProBotLayoutProps) {
  const locale = useLocale();
  const router = useRouter();
  const { setTransitioningToProbot } = useProBotTransition();
  const { user } = useAuth();
  const isContractor = !!user?.businessId;
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  /** Header avatar: 0 = waving (first), 1 = typing (second). Sequence one after the other. */
  const [headerAvatarPhase, setHeaderAvatarPhase] = useState(0);
  const [viewportH, setViewportH] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setHeaderAvatarPhase(1), HEADER_WAVING_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  // Track the visual viewport height so the container shrinks correctly when the on-screen keyboard appears on mobile.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportH(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  // Reveal white card first; keep black overlay until scale-in finishes so user sees black → welcome only.
  useEffect(() => {
    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    rafId = requestAnimationFrame(() => {
      setRevealed(true);
      timeoutId = setTimeout(() => {
        setTransitioningToProbot(false);
      }, ENTRANCE_SCALE_DURATION_MS);
    });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [setTransitioningToProbot]);

  return (
    <ChatProvider>
      {/* Overall container: black, full viewport, no scroll. Chat page only. */}
      {/* height is driven by the visual viewport (tracked in viewportH) so the container shrinks when the on-screen keyboard appears on mobile, keeping the chat input visible. Falls back to 100dvh when not yet measured. */}
      <div
        className="fixed inset-0 min-h-screen h-screen min-h-[100dvh] h-[100dvh] w-full bg-black overflow-hidden flex flex-col pt-2 box-border"
        style={viewportH ? { height: `${viewportH}px` } : undefined}
      >
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col w-full items-center justify-center">
          <div
            className={`w-full max-w-[960px] flex-1 min-h-0 mx-auto border-2 border-black bg-white shadow-lg rounded-lg overflow-hidden flex flex-col transition-transform ease-out origin-center ${
              revealed && !exiting ? 'scale-100' : 'scale-0'
            }`}
            style={{ transitionDuration: exiting ? `${SHRINK_DURATION_MS}ms` : `${ENTRANCE_SCALE_DURATION_MS}ms` }}
          >
            <header className="w-full h-[60px] shrink-0 border-b-2 border-black p-2 md:px-2 md:py-4 bg-white">
            <div className="relative w-full h-full flex items-center justify-between gap-2">
              {/* Left: HPH logo - back to home; reverse animation: chat shrinks to center, then business page emerges */}
              <div className="flex items-center flex-shrink-0 z-10">
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
              </div>

              {/* Center: ProBot image + label (waving GIF first, then typing GIF) */}
              <div className="flex items-center justify-center gap-2 flex-1 min-w-0 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <Image
                    src={headerAvatarPhase === 0 ? PROBOT_ASSETS.avatarHeader : PROBOT_ASSETS.avatarHeaderSecond}
                    alt="ProBot"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
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

            {/* Content area scrolls when taller than viewport (aligns with main app scroll standard) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}
