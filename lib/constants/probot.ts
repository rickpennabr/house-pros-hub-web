/**
 * ProBot UI assets and theme. Change these to update the bot image and chat background
 * across the ProBot layout, sidebar, and chat area. Use same aspect ratio (e.g. square)
 * for avatars so they fit header/sidebar circles.
 */
export const PROBOT_ASSETS = {
  /** Header only: first in sequence (plays once, then switches to avatarHeaderSecond). Use hph-pro-bot-waiving.gif when available. */
  avatarHeader: '/pro-bot-solo.gif',
  /** Header only: second in sequence (shown after avatarHeader duration) */
  avatarHeaderSecond: '/pro-bot-typing-creating-account.gif',
  /** Welcome section only: large image on top of "Hi there" (plays first) */
  avatarWelcome: '/hph-hub-agent-welcome.gif',
  /** Welcome section: second GIF in sequence (plays after avatarWelcome) */
  avatarWelcomeSecond: '/hph-hub-agent-welcome-japa.gif',
  /** Static/stopped avatar: sidebar, chat bubbles, form when not typing */
  avatar: '/hph-pro-bot-typing-static.png',
  /** Typing avatar: chat and form while bot is "typing" */
  avatarAnimated: '/pro-bot-typing-creating-account.gif',
  /** Visitor/customer avatar: admin chat message bubbles */
  visitorAvatar: '/house-pros-hub-logo-simble-bot.png',
} as const;

/** ProBot chat area background. Use Tailwind classes for the main content area. */
export const PROBOT_CHAT_BG = 'probot-sky-bg';
