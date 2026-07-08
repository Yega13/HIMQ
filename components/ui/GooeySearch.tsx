import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

// Modern "gooey" search field: an SVG goo filter (feGaussianBlur + a high-
// contrast feColorMatrix) merges a rounded pill and a few brand-tinted blobs
// into one liquid shape. The blobs drift, and speed up + glow while focused.
// The real <input> rides on top (transparent) so text stays crisp.
export default function GooeySearch({ value, onChange, placeholder, className = '' }: Props) {
  return (
    <div className={`gs-root relative ${className}`}>
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="gooey-search-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div className="gs-goo" aria-hidden="true">
        <span className="gs-pill" />
        <span className="gs-blob gs-b1" />
        <span className="gs-blob gs-b2" />
        <span className="gs-blob gs-b3" />
      </div>

      <Search size={17} className="gs-icon" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="gs-input"
      />

      <style>{`
        .gs-root { --gs-h: 48px; height: var(--gs-h); }
        .gs-goo { position: absolute; inset: -14px; filter: url(#gooey-search-goo); pointer-events: none; z-index: 0; }
        .gs-pill {
          position: absolute; left: 14px; right: 14px; top: 14px; bottom: 14px;
          border-radius: 16px; background: var(--bg-card);
          box-shadow: inset 0 0 0 1.5px var(--border);
        }
        .gs-blob {
          position: absolute; border-radius: 50%; background: var(--color-brand);
          opacity: .55; transition: opacity .3s ease;
        }
        .gs-b1 { width: 26px; height: 26px; left: 6px;  top: 8px;  animation: gs-f1 6s ease-in-out infinite; }
        .gs-b2 { width: 22px; height: 22px; right: 10px; top: 6px;  animation: gs-f2 7s ease-in-out infinite; }
        .gs-b3 { width: 24px; height: 24px; right: 34px; bottom: 6px; animation: gs-f3 5.5s ease-in-out infinite; }
        @keyframes gs-f1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(10px,6px) scale(1.15); } }
        @keyframes gs-f2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-12px,7px) scale(1.1); } }
        @keyframes gs-f3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-8px,-6px) scale(1.2); } }

        .gs-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); z-index: 2; color: var(--text-muted); pointer-events: none; }
        .gs-input {
          position: relative; z-index: 2; width: 100%; height: 100%;
          padding: 0 16px 0 44px; background: transparent; border: 0;
          font-size: 14px; color: var(--text-primary); outline: none;
        }
        .gs-input::placeholder { color: var(--text-muted); }

        /* focused: blobs bulge + brighten, pill picks up a brand ring */
        .gs-root:focus-within .gs-blob { opacity: .85; }
        .gs-root:focus-within .gs-b1 { animation-duration: 3s; }
        .gs-root:focus-within .gs-b2 { animation-duration: 3.5s; }
        .gs-root:focus-within .gs-b3 { animation-duration: 2.8s; }
        .gs-root:focus-within .gs-pill { box-shadow: inset 0 0 0 2px var(--color-brand); }

        @media (prefers-reduced-motion: reduce) {
          .gs-blob { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
