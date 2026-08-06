import { FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import type { SignIn } from '../hooks/useSignIn';
import { useI18n } from '../i18n/useT';
import BrandMark from './BrandMark';
import { Button } from './ui/button';
import { Input } from './ui/input';

/**
 * The sign-in screen — the whole panel, not a field inside a settings list.
 *
 * Hosted mode has exactly one prerequisite, and until it is met there is
 * nothing else on this screen worth a user's attention. A settings form with an
 * email row buried in it says the opposite: that signing in is one of several
 * equally optional things to fill in.
 *
 * It carries its own `<form>`, which is why the settings panel drops its own
 * when this is showing: nesting them is invalid, and the inner submit would
 * save settings instead of sending a link.
 */
export function SignInView({
  signIn,
  onUseOwnKey,
}: {
  signIn: SignIn;
  onUseOwnKey: () => void;
}) {
  const { t } = useI18n();
  const { email, setEmail, sent, busy, error } = signIn;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    signIn.send();
  };

  if (sent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-8 text-center">
        <div className="grid size-11 place-items-center rounded-full bg-accent-soft ring-1 ring-accent-line">
          <MailCheck className="size-5 text-accent-text" aria-hidden />
        </div>
        <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg">
          {t('auth.checkEmail')}
        </h3>
        <p className="text-[12.5px] leading-[1.5] text-fg-secondary">
          {t('auth.sentTo', { email: email.trim() })}
        </p>
        <p className="text-[11.5px] leading-[1.45] text-fg-tertiary">{t('auth.sentHint')}</p>
        {error && (
          <p role="alert" className="text-[11.5px] leading-[1.45] text-negative">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={signIn.reset}
          className="mt-1 cursor-pointer text-[11.5px] text-fg-tertiary underline underline-offset-2 transition-colors duration-200 hover:text-fg-secondary"
        >
          {t('auth.useAnother')}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 overflow-y-auto px-6 py-8"
      onSubmit={handleSubmit}
    >
      <BrandMark size={40} className="mb-3" aria-hidden />
      <h3 className="text-center text-[16px] font-medium tracking-[-0.02em] text-fg">
        {t('auth.title')}
      </h3>
      <p className="mb-4 text-center text-[12.5px] leading-[1.5] text-balance text-fg-secondary">
        {t('auth.subtitle')}
      </p>

      <div className="flex w-full max-w-[260px] flex-col gap-2">
        <label htmlFor="signin-email" className="sr-only">
          {t('auth.emailLabel')}
        </label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          autoFocus
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-[12.5px]"
        />
        <Button type="submit" size="lg" disabled={busy || !email.includes('@')}>
          {busy ? t('account.sending') : t('auth.continue')}
        </Button>
      </div>

      <p className="mt-2.5 max-w-[260px] text-center text-[11px] leading-[1.45] text-fg-tertiary">
        {t('auth.linkHint')}
      </p>

      {error && (
        <p role="alert" className="mt-2 max-w-[260px] text-center text-[11.5px] text-negative">
          {error}
        </p>
      )}

      {/* The escape hatch, below a divider so it reads as "or, if you must"
          rather than a second thing to choose between. */}
      <div className="mt-6 flex w-full max-w-[260px] items-center gap-2" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] tracking-[0.06em] text-fg-tertiary uppercase">
          {t('auth.or')}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={onUseOwnKey}
        className="mt-2.5 cursor-pointer text-[11.5px] text-fg-tertiary underline underline-offset-2 transition-colors duration-200 hover:text-fg-secondary"
      >
        {t('settings.switchToByok')}
      </button>
    </form>
  );
}
