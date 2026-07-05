import { ReactNode } from 'react';
import Logo from './Logo';

// Full-screen blocking page with NO navbar / footer — used for unauthorized /
// not-signed-in states so the app chrome isn't shown to people who can't use it.
export default function Blocked({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <Logo height={40} />
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{title}</h1>
      {message && <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">{message}</p>}
      {action}
    </div>
  );
}
