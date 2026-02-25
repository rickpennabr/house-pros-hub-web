'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send, MessageCircle } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import ChatSignupForm from '@/components/chat/ChatSignupForm';
import ChatEstimateForm from '@/components/chat/ChatEstimateForm';
import { LeavePageWarningModal } from '@/app/[locale]/(auth)/signup/components/LeavePageWarningModal';
import ProCard, { type ProCardData } from '@/components/proscard/ProCard';

export interface ChatMessage {
  id: string;
  sender: 'visitor' | 'admin';
  body: string;
  created_at: string;
}

type UserChoice = null | 'account_estimate' | 'talk_to_pro' | 'call_hub' | 'chat_with_hub' | 'message_a_pro';

const CHOICE_QUESTION = 'What do you want to do today?';
const CHOICE_TYPING_MS = 43; // 1.2x faster
const CHOICE_INITIAL_DELAY_MS = 909; // 1200/1.2
const CHOICE_BUTTON_DELAY_MS = 303; // 400/1.2
const HUB_PHONE = '702-232-0411';

/**
 * ProBot chat drawer: choice options (guest: 2 buttons, logged-in: 5), then chat or form.
 */
export default function BotChatDrawer() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('bot');
  const tSuccess = useTranslations('estimate.success');
  const tChat = useTranslations('auth.signup.chat');
  const { isOpen, closeChat, visitorId, conversationId, setConversationId, initialChoiceForDrawer, clearInitialChoiceForDrawer } = useChat();
  const { isAuthenticated } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userChoice, setUserChoice] = useState<UserChoice>(null);
  /** Once user has left the first modal (choice), keep drawer centered so it doesn’t jump back to right */
  const [hasLeftChoiceScreen, setHasLeftChoiceScreen] = useState(false);
  const [estimateSubmitted, setEstimateSubmitted] = useState(false);
  const [choiceQuestionTyped, setChoiceQuestionTyped] = useState(0);
  const [visibleButtonCount, setVisibleButtonCount] = useState(0);
  const [choiceTypingStarted, setChoiceTypingStarted] = useState(false);
  const [signupStepIndex, setSignupStepIndex] = useState(0);
  const [estimateFormBotTyping, setEstimateFormBotTyping] = useState(false);
  const [showLeaveSignupModal, setShowLeaveSignupModal] = useState(false);
  const [showProjectInfoForm, setShowProjectInfoForm] = useState(false);
  const [projectEstimateSubmitted, setProjectEstimateSubmitted] = useState(false);
  const [projectFormBotTyping, setProjectFormBotTyping] = useState(false);
  const [estimateFormKey, setEstimateFormKey] = useState(0);
  const [showCallHubModal, setShowCallHubModal] = useState(false);
  const [selectedBusinessForMessage, setSelectedBusinessForMessage] = useState<{ id: string; businessName: string } | null>(null);
  const [chatProList, setChatProList] = useState<ProCardData[]>([]);
  const [chatProListLoading, setChatProListLoading] = useState(false);
  const [chatProListError, setChatProListError] = useState<string | null>(null);

  const choiceButtonCount = isAuthenticated ? 5 : 2;

  const loadConversationAndMessages = useCallback(async () => {
    if (!visitorId) return;
    setLoading(true);
    setError(null);
    try {
      const convRes = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      });
      if (!convRes.ok) {
        const d = await convRes.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to load chat');
      }
      const { conversationId: cid } = await convRes.json();
      setConversationId(cid);

      const msgRes = await fetch(
        `/api/chat/messages?conversationId=${encodeURIComponent(cid)}&visitorId=${encodeURIComponent(visitorId)}`
      );
      if (!msgRes.ok) throw new Error('Failed to load messages');
      await msgRes.json(); // consume body
      // Always show initial choice screen on open; conversationId is still used for sending
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [visitorId, setConversationId]);

  const showChoice = userChoice === null && !loading && messages.length === 0 && !error;
  const showChat =
    userChoice === 'talk_to_pro' ||
    userChoice === 'chat_with_hub' ||
    userChoice === 'message_a_pro' ||
    messages.length > 0;
  const showEstimateForm = userChoice === 'account_estimate' && !estimateSubmitted && !showProjectInfoForm;
  const showEstimateSuccess = userChoice === 'account_estimate' && estimateSubmitted && !showProjectInfoForm && !projectEstimateSubmitted;
  const showProjectInfoFormView = userChoice === 'account_estimate' && showProjectInfoForm && !projectEstimateSubmitted;
  const showProjectEstimateSuccess = userChoice === 'account_estimate' && showProjectInfoForm && projectEstimateSubmitted;
  const showProList = (userChoice === 'talk_to_pro' || userChoice === 'message_a_pro') && !selectedBusinessForMessage;
  const showMessageInput =
    showChat &&
    !showEstimateForm &&
    !showProjectInfoFormView &&
    !showProList &&
    (userChoice !== 'message_a_pro' || !!selectedBusinessForMessage);

  /** Hide header bot image while bot is typing in any view (choice, chat, signup form, or project form) */
  const isBotTyping =
    (showChoice && choiceQuestionTyped < CHOICE_QUESTION.length) ||
    (showChat && sending) ||
    (showEstimateForm && estimateFormBotTyping) ||
    (showProjectInfoFormView && projectFormBotTyping);

  const handleCloseChat = useCallback(() => {
    if (showEstimateForm && signupStepIndex >= 3) {
      setShowLeaveSignupModal(true);
    } else {
      closeChat();
    }
  }, [showEstimateForm, signupStepIndex, closeChat]);

  const handleConfirmLeaveSignup = useCallback(() => {
    setShowLeaveSignupModal(false);
    closeChat();
  }, [closeChat]);

  // Ref so escape listener always uses latest handleCloseChat without re-running effect when signupStepIndex changes
  const handleCloseChatRef = useRef(handleCloseChat);
  handleCloseChatRef.current = handleCloseChat;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseChatRef.current();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      // Only load conversation when opening the drawer, not when user is already in the signup form
      // (otherwise signupStepIndex changes would re-run this effect, set loading=true, and unmount the form)
      if (userChoice !== 'account_estimate') {
        loadConversationAndMessages();
      }
    } else {
      setUserChoice(null);
      setHasLeftChoiceScreen(false);
      setEstimateSubmitted(false);
      setShowProjectInfoForm(false);
      setProjectEstimateSubmitted(false);
      setChoiceQuestionTyped(0);
      setVisibleButtonCount(0);
      setChoiceTypingStarted(false);
      setSignupStepIndex(0);
      setMessages([]);
      setError(null);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, userChoice, loadConversationAndMessages]);

  // Lock position to “centered” after user leaves the first modal so it doesn’t jump right → center
  useEffect(() => {
    if (isOpen && initialChoiceForDrawer === 'account_estimate') {
      setUserChoice('account_estimate');
      setHasLeftChoiceScreen(true);
      setChoiceTypingStarted(true);
      setChoiceQuestionTyped(CHOICE_QUESTION.length);
      setVisibleButtonCount(choiceButtonCount);
      clearInitialChoiceForDrawer();
    }
  }, [isOpen, initialChoiceForDrawer, clearInitialChoiceForDrawer, choiceButtonCount]);

  // Lock position centered after user leaves the first modal so drawer does not jump back to right
  useEffect(() => {
    if (userChoice !== null) setHasLeftChoiceScreen(true);
  }, [userChoice]);

  // Auto-close drawer 5 seconds after showing "Your estimate request has been submitted"
  useEffect(() => {
    if (!showProjectEstimateSuccess) return;
    const id = setTimeout(() => closeChat(), 5000);
    return () => clearTimeout(id);
  }, [showProjectEstimateSuccess, closeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch pros list when user chooses "Talk to a pro" or "Message a pro"
  useEffect(() => {
    if (!isOpen || (userChoice !== 'talk_to_pro' && userChoice !== 'message_a_pro')) return;
    setChatProListLoading(true);
    setChatProListError(null);
    fetch('/api/businesses')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load pros');
        return res.json();
      })
      .then((data) => {
        const list = (data.businesses || []) as ProCardData[];
        setChatProList(list);
      })
      .catch((e) => setChatProListError(e instanceof Error ? e.message : 'Failed to load pros'))
      .finally(() => setChatProListLoading(false));
  }, [isOpen, userChoice]);

  // Poll for new messages (admin replies) while drawer is open; skip when on estimate form to avoid state churn
  useEffect(() => {
    if (!isOpen || !conversationId || !visitorId || userChoice === 'account_estimate') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&visitorId=${encodeURIComponent(visitorId)}`
        );
        if (res.ok) {
          const { messages: msgs } = await res.json();
          setMessages(msgs ?? []);
        }
      } catch {
        // ignore
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, conversationId, visitorId, userChoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || !visitorId || sending) return;
    setSending(true);
    setError(null);
    const toBusinessId = selectedBusinessForMessage?.id;
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          visitorId,
          body: trimmed,
          ...(toBusinessId ? { businessId: toBusinessId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setInputValue('');
      if (toBusinessId) {
        setSelectedBusinessForMessage(null);
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        if (!conversationId && data.message.conversationId) {
          setConversationId(data.message.conversationId);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const sendCannedMessage = useCallback(
    async (body: string, choice: UserChoice) => {
      if (!visitorId || sending) return;
      setUserChoice(choice);
      setSending(true);
      setError(null);
      try {
        const res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversationId ?? undefined,
            visitorId,
            body,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Failed to send');
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
          if (!conversationId && data.message.conversationId) {
            setConversationId(data.message.conversationId);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
      } finally {
        setSending(false);
      }
    },
    [visitorId, conversationId, setConversationId, sending]
  );

  const handleCallHub = () => setShowCallHubModal(true);
  const handleConfirmCallHub = () => {
    setShowCallHubModal(false);
    window.location.href = `tel:+1${HUB_PHONE.replace(/\D/g, '')}`;
  };
  const handleTalkToPro = () => {
    setUserChoice('talk_to_pro');
    setHasLeftChoiceScreen(true);
  };
  const handleChatWithHub = () => sendCannedMessage('I\'d like to chat with the Hub.', 'chat_with_hub');
  const handleMessageAPro = () => {
    setUserChoice('message_a_pro');
    setHasLeftChoiceScreen(true);
  };

  // Delay before starting to type
  useEffect(() => {
    if (!showChoice) return;
    const id = setTimeout(() => setChoiceTypingStarted(true), CHOICE_INITIAL_DELAY_MS);
    return () => clearTimeout(id);
  }, [showChoice]);

  // Choice screen: type question then reveal buttons one by one (must run after showChoice is defined)
  useEffect(() => {
    if (!showChoice || !choiceTypingStarted) return;
    if (choiceQuestionTyped < CHOICE_QUESTION.length) {
      const id = setTimeout(() => setChoiceQuestionTyped((n) => n + 1), CHOICE_TYPING_MS);
      return () => clearTimeout(id);
    }
    if (visibleButtonCount < choiceButtonCount) {
      const id = setTimeout(() => setVisibleButtonCount((n) => n + 1), CHOICE_BUTTON_DELAY_MS);
      return () => clearTimeout(id);
    }
  }, [showChoice, choiceTypingStarted, choiceQuestionTyped, visibleButtonCount, choiceButtonCount]);

  if (!isOpen) return null;

  const isAccountEstimate = userChoice === 'account_estimate';

  return (
    <>
      {/* Backdrop: 90% black, fades in over 2s when chat opens */}
      <button
        type="button"
        className="fixed inset-0 z-[109] cursor-pointer border-0 p-0 bg-black/90 animate-backdrop-fade-in"
        aria-label="Close chat"
        onClick={handleCloseChat}
      />
      <div
        className={`fixed inset-0 z-[110] flex flex-col md:inset-auto md:bottom-[244px] md:top-auto md:max-w-[calc(100vw-2rem)] md:rounded-none md:shadow-xl bg-transparent pointer-events-none md:pointer-events-auto ${
          (showChoice || (loading && !hasLeftChoiceScreen))
            ? 'md:right-[calc(max(1rem,calc((100vw-960px)/2+1rem))+40px)] md:left-auto'
            : 'md:left-1/2 md:right-auto md:-translate-x-1/2'
        } ${isAccountEstimate ? 'md:w-[462px] md:h-[520px]' : userChoice === 'chat_with_hub' ? 'md:w-[420px] md:h-[480px]' : userChoice === 'talk_to_pro' || userChoice === 'message_a_pro' ? 'md:w-[400px] md:h-[520px]' : 'md:w-[352px] md:h-[380px]'}`}
        role="dialog"
        aria-label="ProBot chat"
        ref={drawerRef}
      >
        <div
          className="relative z-10 flex flex-col h-full md:flex-col md:items-center md:h-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <div className="flex flex-col h-full md:h-[calc(100%-10px)] md:w-full md:max-h-full bg-white md:rounded-lg overflow-hidden border border-black">
            <header className="flex items-center justify-between shrink-0 h-[60px] md:h-11 px-3 border-b border-black bg-white">
              <div className="flex items-center gap-2">
                {!isBotTyping && (
                  <img
                    src="/pro-bot-typing.png"
                    alt=""
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain shrink-0"
                  />
                )}
                <h2 className="text-lg font-semibold text-black md:text-base">ProBot</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseChat}
                className="p-2 rounded-full hover:bg-gray-200 text-black transition-colors focus:outline-none focus:ring-2 focus:ring-black min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {error && (
              <p className="text-base text-red-600 text-center py-2 md:text-sm" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <p className="text-base text-gray-500 text-center py-4 md:text-sm">Loading...</p>
            ) : showChoice ? (
              <div className="flex flex-col gap-3 py-3">
                <div className="flex flex-col gap-2">
                  <div className="self-start flex items-end gap-0 min-h-[48px] rounded-2xl overflow-hidden">
                    {/* Bot avatar: typing gif while typing, static image when done; stays in place for next question */}
                    <div className="shrink-0 flex-shrink-0 w-12 h-12 flex items-center justify-center" aria-hidden>
                      <img
                        src={choiceQuestionTyped < CHOICE_QUESTION.length ? '/pro-bot-solo-typing-new.gif' : '/pro-bot-typing.png'}
                        alt=""
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain pointer-events-none"
                      />
                    </div>
                    {choiceQuestionTyped > 0 && (
                      <div className="max-w-[85%] rounded-2xl bg-gray-100 text-gray-900 px-3 py-2 text-base shadow-sm border-0 md:text-sm">
                        {CHOICE_QUESTION.slice(0, choiceQuestionTyped)}
                        {choiceQuestionTyped < CHOICE_QUESTION.length && (
                          <span className="animate-blink-caret text-gray-700" aria-hidden>|</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-[280px]">
                  {!isAuthenticated && visibleButtonCount >= 1 && (
                    <button
                      type="button"
                      onClick={() => setUserChoice('account_estimate')}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium cursor-pointer hover:bg-black hover:text-white transition-colors animate-fade-in md:text-sm"
                    >
                      {t('choiceAccountEstimate')}
                    </button>
                  )}
                  {!isAuthenticated && visibleButtonCount >= 2 && (
                    <button
                      type="button"
                      onClick={handleTalkToPro}
                      disabled={sending}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium cursor-pointer hover:bg-black hover:text-white transition-colors disabled:opacity-60 animate-fade-in md:text-sm"
                    >
                      {t('choiceTalkToPro')}
                    </button>
                  )}
                  {isAuthenticated && visibleButtonCount >= 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserChoice('account_estimate');
                        setShowProjectInfoForm(true);
                      }}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium cursor-pointer hover:bg-black hover:text-white transition-colors animate-fade-in md:text-sm"
                    >
                      {t('choiceRequestEstimate')}
                    </button>
                  )}
                  {isAuthenticated && visibleButtonCount >= 2 && (
                    <button
                      type="button"
                      onClick={handleCallHub}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium cursor-pointer hover:bg-black hover:text-white transition-colors animate-fade-in md:text-sm"
                    >
                      {t('choiceCallHub')}
                    </button>
                  )}
                  {isAuthenticated && visibleButtonCount >= 3 && (
                    <button
                      type="button"
                      onClick={handleTalkToPro}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium cursor-pointer hover:bg-black hover:text-white transition-colors animate-fade-in md:text-sm"
                    >
                      {t('choiceTalkToPro')}
                    </button>
                  )}
                  {isAuthenticated && visibleButtonCount >= 4 && (
                    <button
                      type="button"
                      onClick={handleChatWithHub}
                      disabled={sending}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium hover:bg-black hover:text-white transition-colors disabled:opacity-60 animate-fade-in cursor-pointer md:text-sm"
                    >
                      {t('choiceChatWithHub')}
                    </button>
                  )}
                  {isAuthenticated && visibleButtonCount >= 5 && (
                    <button
                      type="button"
                      onClick={handleMessageAPro}
                      className="w-full py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium cursor-pointer hover:bg-black hover:text-white transition-colors animate-fade-in cursor-pointer md:text-sm"
                    >
                      {t('choiceMessageAPro')}
                    </button>
                  )}
                </div>
              </div>
            ) : showEstimateForm ? (
              <div className="flex flex-col min-h-0 flex-1">
                <ChatSignupForm
                  showBackToChoice
                  onCancel={() => setUserChoice(null)}
                  onSuccess={() => setEstimateSubmitted(true)}
                  onStepIndexChange={setSignupStepIndex}
                  onBotTypingChange={setEstimateFormBotTyping}
                />
              </div>
            ) : showProjectInfoFormView ? (
              <div className="flex flex-col min-h-0 flex-1">
                <ChatEstimateForm
                  key={estimateFormKey}
                  onSuccess={() => setProjectEstimateSubmitted(true)}
                  onBack={() => setShowProjectInfoForm(false)}
                  onBotTypingChange={setProjectFormBotTyping}
                />
              </div>
            ) : showEstimateSuccess ? (
              <div className="space-y-6 flex-1 flex flex-col min-h-0 py-4 px-2">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center">
                    <svg
                      className="w-16 h-16 mx-auto text-green-600 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h2 className="text-2xl font-semibold mb-4 text-black">
                      {t('estimateSuccessMessageLine1')}
                    </h2>
                    <p className="text-gray-700">
                      {t('estimateSuccessMessageLine2')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      closeChat();
                      router.push(`/${locale}`);
                    }}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium hover:bg-black hover:text-white transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {t('goToHomePage')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProjectInfoForm(true)}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-gray-900 text-white text-base font-medium hover:bg-gray-800 transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {t('getAnEstimate')}
                  </button>
                </div>
              </div>
            ) : showProjectEstimateSuccess ? (
              <div className="flex flex-col gap-4 py-4 px-2 flex-1 min-h-0 overflow-y-auto">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center">
                    <svg
                      className="w-16 h-16 mx-auto text-green-600 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h2 className="text-2xl font-semibold mb-4 text-black">
                      {tSuccess('title')}
                    </h2>
                    <p className="text-gray-700">
                      {tSuccess('body')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      closeChat();
                      router.push(`/${locale}`);
                    }}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-white text-gray-900 text-base font-medium hover:bg-black hover:text-white transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {tSuccess('goToHome')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectEstimateSubmitted(false);
                      setEstimateFormKey((k) => k + 1);
                    }}
                    className="flex-1 py-3 px-4 rounded-lg border-2 border-black bg-gray-900 text-white text-base font-medium hover:bg-gray-800 transition-colors cursor-pointer md:text-sm whitespace-nowrap"
                  >
                    {tSuccess('requestNewEstimate')}
                  </button>
                </div>
              </div>
            ) : showProList ? (
              <div className="flex flex-col gap-3 py-3 flex-1 min-h-0 overflow-y-auto">
                <p className="text-sm text-gray-700 px-1">{t('prosListHeading')}</p>
                {chatProListLoading ? (
                  <p className="text-sm text-gray-500 py-4">Loading pros...</p>
                ) : chatProListError ? (
                  <p className="text-sm text-red-600 py-2">{chatProListError}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {chatProList.map((b) => (
                      <div key={b.id} className="flex flex-col gap-1.5">
                        <ProCard data={b} isListMode={true} />
                        {userChoice === 'message_a_pro' && (
                          <button
                            type="button"
                            onClick={() => setSelectedBusinessForMessage({ id: b.id, businessName: b.businessName })}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border-2 border-black bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" /> {t('messagePro')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedBusinessForMessage ? (
              <div className="flex flex-col flex-1 min-h-0 p-3">
                <button
                  type="button"
                  onClick={() => setSelectedBusinessForMessage(null)}
                  className="self-start text-sm text-gray-600 hover:text-black mb-2 underline"
                >
                  ← Back to pros
                </button>
                <p className="text-sm font-medium text-black mb-3">{t('messagingPro', { name: selectedBusinessForMessage.businessName })}</p>
                <div className="flex-1 min-h-0" />
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] px-3 py-2 text-base shadow-sm md:text-sm ${
                      m.sender === 'visitor'
                        ? 'self-end rounded-2xl rounded-tr-sm bg-gray-900 text-white'
                        : 'self-start rounded-2xl rounded-tl-sm bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          {showMessageInput && (
            <form
              onSubmit={handleSubmit}
              className="shrink-0 p-2 border-t border-gray-200 bg-gray-50 flex gap-2 items-end"
            >
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                disabled={sending || loading}
                className="flex-1 min-h-[44px] max-h-32 py-3 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none text-base text-gray-900 placeholder-gray-500 disabled:opacity-60 md:text-sm"
                aria-label="Message"
              />
              <button
                type="submit"
                disabled={sending || loading || !inputValue.trim()}
                className="shrink-0 w-12 h-12 rounded-lg border border-black bg-white text-black flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-black min-w-[48px] min-h-[48px] disabled:opacity-60 cursor-pointer md:hover:bg-black md:hover:text-white md:hover:border-black"
                aria-label="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
      <LeavePageWarningModal
        isOpen={showLeaveSignupModal}
        onConfirm={handleConfirmLeaveSignup}
        onCancel={() => setShowLeaveSignupModal(false)}
        title={tChat('closeWarningTitle')}
        message={tChat('closeWarningMessage')}
        cancelLabel={tChat('closeWarningCancel')}
        confirmLabel={tChat('closeWarningConfirm')}
      />
      {/* Call the Hub confirm modal */}
      {showCallHubModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="call-hub-title">
          <div className="bg-white border-2 border-black rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 id="call-hub-title" className="text-lg font-semibold text-black mb-2">{t('callHubModalTitle')}</h3>
            <p className="text-gray-700 mb-6">{t('callHubModalMessage', { number: HUB_PHONE })}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCallHubModal(false)}
                className="py-2 px-4 rounded-lg border-2 border-black bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors"
              >
                {t('callHubModalCancel')}
              </button>
              <a
                href={`tel:+1${HUB_PHONE.replace(/\D/g, '')}`}
                onClick={handleConfirmCallHub}
                className="py-2 px-4 rounded-lg border-2 border-black bg-black text-white font-medium hover:bg-gray-800 transition-colors no-underline inline-block"
              >
                {t('callHubModalCall')}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
