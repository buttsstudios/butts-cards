'use client';

// React wrapper around lib/share.ts (plain DOM, copied verbatim from the canonical share.ts).
// On phones it opens the system share sheet; elsewhere a small menu: Copy link, X, Facebook, LinkedIn,
// Threads, Reddit (plain intent URLs, no SDKs, no pixels). Links carry utm_source=share.
// The wrapper uses display: contents so the button sits in the parent's flex row like a sibling.

import { useEffect, useRef } from 'react';
import { createShare, type ShareColors, type ShareSpec } from '@/lib/share';

export const SHARE_COLORS: ShareColors = {
  accent: 'var(--bs-accent)', bg: 'var(--bs-ink)', panel: 'transparent', line: 'var(--bs-line)',
  ink: 'var(--bs-bone)', button: 'var(--bs-accent)', buttonInk: 'var(--bs-ink)',
};

/** A gtag "share" event, only when the page already has gtag. No tracker is added here. */
export function reportShare(medium: string, item: string) {
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (typeof g === 'function') g('event', 'share', { method: medium, content_type: 'play', item_id: item });
}

export default function ShareButton({ spec, item, label, primary, autoFocus }: {
  spec: ShareSpec; item: string; label?: string; primary?: boolean; autoFocus?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    if (!host.current) return;
    const w = createShare({ spec: () => specRef.current, colors: SHARE_COLORS, label, primary, onShare: (m) => reportShare(m, item) });
    host.current.appendChild(w.el);
    if (autoFocus) w.button.focus({ preventScroll: true });
    return () => w.destroy();
    // label/primary/item are fixed for the life of the result card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="share-slot" style={{ display: 'contents' }} />;
}
