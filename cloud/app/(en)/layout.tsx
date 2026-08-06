import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';

/**
 * English root layout. The Chinese pages have their own (`app/(zh)`) so that
 * `<html lang>` and the font set are actually right for each — App Router only
 * lets a root layout render `<html>`, and route groups are how you get two.
 */

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600;700&family=Syne:wght@650;700;800&display=swap';

export const metadata: Metadata = {
  icons: { icon: '/favicon.png' },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  // Browser extensions decorate <html> before React hydrates — the translation
  // ones add theme attributes — and the resulting mismatch warning is noise we
  // cannot fix from here. suppressHydrationWarning is scoped to this element, so
  // a genuine mismatch inside the page still reports.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
