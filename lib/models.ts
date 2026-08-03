// Client-safe model definitions — no secrets here
export const MODELS = [
  {
    id: 'may1' as const,
    name: 'May',
    subtitle: 'Best quality',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    dot: 'bg-red-500',
  },
  {
    id: 'gemini' as const,
    name: 'Aris',
    subtitle: 'Fast',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    dot: 'bg-blue-500',
  },
] as const;

export type ModelId = typeof MODELS[number]['id'];
// Default to Aris, not May. Free tier gets force-downgraded to Aris anyway
// (see effectiveModel in lib/credits.ts) once the meter is on, but the UI
// would still show May as "selected" — misleading. More importantly for
// Student: May is a limited, capped resource (PREMIUM_DAILY_CAP). Defaulting
// to it means a student can burn part of today's cap on a message they never
// deliberately chose to spend on May. Opt into May, don't opt out of it.
export const DEFAULT_MODEL: ModelId = 'gemini';
