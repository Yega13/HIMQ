import { ExternalLink, PlayCircle } from 'lucide-react';

// Renders a resource May surfaced mid-lesson: a YouTube video (embedded player),
// a diagram (image), or a link card. Data comes from a resolved [[media]] block
// in the assistant message, so the URL is always one of the curated, verified
// resources — never model-invented.

function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function MediaEmbed({ type, url, title }: { type: string; url: string; title?: string }) {
  if (type === 'video') {
    const id = youTubeId(url);
    if (id) {
      return (
        <span className="block my-3 not-prose">
          <span className="block relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-black" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title={title || 'Video'}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </span>
          {title && <span className="block mt-1.5 text-[11px] text-[var(--text-muted)]">{title}</span>}
        </span>
      );
    }
    return <MediaLink url={url} title={title} icon={<PlayCircle size={14} />} />;
  }

  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block my-3 w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title || 'Illustration'}
          loading="lazy"
          className="rounded-xl border border-[var(--border)] bg-white max-h-72 w-auto"
        />
        {title && <span className="block mt-1.5 text-[11px] text-[var(--text-muted)]">{title}</span>}
      </a>
    );
  }

  return <MediaLink url={url} title={title} />;
}

function MediaLink({ url, title, icon }: { url: string; title?: string; icon?: React.ReactNode }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 my-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-sm font-medium text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors"
    >
      {icon ?? <ExternalLink size={14} />}
      {title || url}
    </a>
  );
}
