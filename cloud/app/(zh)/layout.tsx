import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';

/** Chinese root layout — see `app/(en)/layout.tsx`. Differs in `lang` and in
 * pulling Noto Sans SC, which the English pages have no use for. */

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;600;700&family=Public+Sans:wght@400;500;600;700&family=Syne:wght@650;700;800&display=swap';

export const metadata: Metadata = {
  icons: { icon: '/favicon.png' },
};

export default function ZhLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS} rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
