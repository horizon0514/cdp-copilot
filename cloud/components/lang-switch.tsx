'use client';

/**
 * EN / 中文 toggle.
 *
 * Clicking one records the choice, which is what the redirect script in the
 * English root layout reads on a later visit — otherwise a reader who picked
 * English on a Chinese-locale browser would be bounced to /zh every time.
 * Replaces the old `locale.js`.
 */
export const LOCALE_STORAGE_KEY = 'pagehand:site-locale';

export function LangSwitch({
  label,
  current,
  enHref,
  zhHref,
}: {
  label: string;
  current: 'en' | 'zh';
  enHref: string;
  zhHref: string;
}) {
  const remember = (locale: 'en' | 'zh') => () => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Private mode or blocked storage: the link still navigates.
    }
  };

  return (
    <div className="lang-switch" role="group" aria-label={label}>
      <a
        href={enHref}
        hrefLang="en"
        data-locale="en"
        onClick={remember('en')}
        {...(current === 'en' ? { 'aria-current': 'page' as const } : {})}
      >
        EN
      </a>
      <span aria-hidden="true">/</span>
      <a
        href={zhHref}
        hrefLang="zh-CN"
        data-locale="zh"
        onClick={remember('zh')}
        {...(current === 'zh' ? { 'aria-current': 'page' as const } : {})}
      >
        中文
      </a>
    </div>
  );
}
