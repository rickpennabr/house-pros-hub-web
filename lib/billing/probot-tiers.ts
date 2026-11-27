/**
 * What ProBot can do on each Hub plan (Free, Pro, Team, Business). Safe for client and server:
 * the server enforces it, the subscription page and voice picker show it.
 */

export interface ProbotTier {
  /** ProBot answers per day. */
  dailyAnswers: number;
  /** Voice notes ProBot listens to and answers by voice, per day. */
  dailyVoice: number;
  /** All named voices (Free gets Max and Sofia). */
  allVoices: boolean;
  /** The smarter model with thinking for business questions. */
  smartModel: boolean;
  /** Lines for the plan cards. */
  features: string[];
}

export const FREE_VOICES = ['max', 'sofia'];

export const PROBOT_TIERS: Record<string, ProbotTier> = {
  free: {
    dailyAnswers: 25,
    dailyVoice: 5,
    allVoices: false,
    smartModel: false,
    features: ['ProBot: 25 answers a day', '5 voice replies a day', 'Voices: Max and Sofia'],
  },
  pro: {
    dailyAnswers: 300,
    dailyVoice: 60,
    allVoices: true,
    smartModel: true,
    features: ['ProBot Smart: thinks through your business', '300 answers and 60 voice replies a day', 'All voices, including Bolt the robot'],
  },
  team: {
    dailyAnswers: 600,
    dailyVoice: 150,
    allVoices: true,
    smartModel: true,
    features: ['ProBot Smart for the whole team', '600 answers and 150 voice replies a day', 'All voices'],
  },
  business: {
    dailyAnswers: 1000,
    dailyVoice: 300,
    allVoices: true,
    smartModel: true,
    features: ['ProBot Smart, highest limits', '1,000 answers and 300 voice replies a day', 'All voices'],
  },
};

/** The tier for a plan slug. A new paid plan the admin adds gets Pro's ProBot. */
export function probotTier(planSlug: string | null | undefined): ProbotTier {
  if (!planSlug || planSlug === 'free') return PROBOT_TIERS.free;
  return PROBOT_TIERS[planSlug] ?? PROBOT_TIERS.pro;
}

export function voiceAllowed(tier: ProbotTier, voiceId: string): boolean {
  return tier.allVoices || FREE_VOICES.includes(voiceId);
}
