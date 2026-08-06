import type { SignIn } from '../hooks/useSignIn';
import { useI18n } from '../i18n/useT';
import { Button } from './ui/button';

/**
 * The account, once there is one — the settled counterpart to `SignInView`.
 *
 * Signing in is the whole of hosted setup, so afterwards there is nothing to
 * configure and this shrinks to what a settings screen owes the user: which
 * account is in use, and how to leave it.
 */
export function AccountRow({ signIn }: { signIn: SignIn }) {
  const { t } = useI18n();
  const { session } = signIn;
  if (!session) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span className="size-1.5 shrink-0 rounded-full bg-positive" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
        {session.email ?? t('account.signedIn')}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={signIn.signOut}>
        {t('account.signOut')}
      </Button>
    </div>
  );
}
