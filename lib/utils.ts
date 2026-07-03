import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'Date TBD';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

export function daysUntil(dateString: string | null): string {
  if (!dateString) return 'Date TBD';
  try {
    const date = new Date(dateString);
    if (isPast(date)) return 'Expired';
    const days = differenceInDays(date, new Date());
    if (days === 0) return 'Today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  } catch {
    return 'Unknown';
  }
}

export function timeAgo(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

// Maps an app locale to a human language name for AI prompts, so May replies in
// the language the student is using the app in.
export function languageName(lang?: string | null): string {
  switch (lang) {
    case 'am': return 'Armenian (Հայերեն)';
    case 'ru': return 'Russian (Русский)';
    default:   return 'English';
  }
}
