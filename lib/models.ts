// Client-safe model definitions — no secrets here
export const MODELS = [
  {
    id: 'may1' as const,
    name: 'May-1',
    subtitle: 'Best quality',
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    dot: 'bg-orange-500',
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
export const DEFAULT_MODEL: ModelId = 'may1';
