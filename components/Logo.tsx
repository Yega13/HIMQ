import Link from 'next/link';

interface LogoProps {
  height?: number;
  className?: string;
}

export default function Logo({ height = 32, className = '' }: LogoProps) {
  return (
    <Link href="/" className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-light.png"
        alt="Himq"
        className="block dark:hidden"
        style={{ height: `${height}px`, width: 'auto' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dark.png"
        alt="Himq"
        className="hidden dark:block"
        style={{ height: `${Math.round(height * 1.2)}px`, width: 'auto' }}
      />
    </Link>
  );
}
