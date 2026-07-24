// Client-safe model definitions — no secrets here
export const MODELS = [
  {
    id: 'may1' as const,
    name: 'May-1',
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
export const DEFAULT_MODEL: ModelId = 'may1';
