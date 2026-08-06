import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Languages, Sparkles, X } from 'lucide-react';
import {
  Settings,
  ProviderId,
  ByokProviderId,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  DEEPSEEK_BASE_URL,
  HOSTED_BASE_URL,
  HOSTED_MODELS,
  isHosted,
} from '../../lib/storage/schema';
import type { LocalePreference } from '../../lib/i18n';
import { useI18n } from '../i18n/useT';
import { AccountField } from './AccountField';
import { Label, SectionLabel } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';

/** Kept in sync with `host_permissions` in manifest.config.ts — origins listed
 * there are already granted, so asking again would raise a needless dialog. */
const DEFAULT_HOST_ORIGINS = new Set([
  'https://pagehand.app',
  'https://api.openai.com',
  'https://api.anthropic.com',
  'https://api.deepseek.com',
]);

interface Props {
  initial: Settings | null;
  onSave: (settings: Settings) => Promise<void>;
  onClose: () => void;
}

async function ensureHostPermission(
  baseURL: string | undefined,
  denyMessage: (origin: string) => string,
): Promise<void> {
  if (!baseURL) return;
  const origin = new URL(baseURL).origin;
  if (DEFAULT_HOST_ORIGINS.has(origin)) return;

  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) throw new Error(denyMessage(origin));
}

function Field({
  label,
  hint,
  htmlFor,
  badge,
  trailing,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  badge?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex min-h-4 items-center gap-1.5">
        <Label htmlFor={htmlFor} className="min-w-0 flex-1 truncate">
          {label}
        </Label>
        {badge && (
          <span className="shrink-0 rounded px-1 py-px text-[10px] font-medium tracking-[0.02em] text-fg-tertiary ring-1 ring-line">
            {badge}
          </span>
        )}
        {trailing}
      </div>
      {children}
      {hint && <p className="text-[11px] leading-[1.4] text-fg-tertiary">{hint}</p>}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <Icon className="size-3 text-fg-tertiary" aria-hidden />
        <SectionLabel className="px-0">{title}</SectionLabel>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        {children}
      </div>
    </section>
  );
}

export default function SettingsPanel({ initial, onSave, onClose }: Props) {
  const { t, preference, setPreference } = useI18n();
  const firstRun = initial == null;
  const [provider, setProvider] = useState<ProviderId>(initial?.provider ?? DEFAULT_PROVIDER);
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [model, setModel] = useState(initial?.model ?? DEFAULT_MODELS[DEFAULT_PROVIDER]);
  const [baseURL, setBaseURL] = useState(initial?.baseURL ?? '');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hosted = isHosted(provider);
  const [lastByokProvider, setLastByokProvider] = useState<ByokProviderId>(
    initial && !isHosted(initial.provider)
      ? (initial.provider as ByokProviderId)
      : DEFAULT_PROVIDER,
  );
  useEffect(() => {
    if (!hosted) setLastByokProvider(provider as ByokProviderId);
  }, [hosted, provider]);

  // Settings saved before the catalogue changed — or carried over from a BYOK
  // provider — would otherwise render the select blank and save an id the
  // server will reject.
  const hostedModel = (HOSTED_MODELS as readonly string[]).includes(model)
    ? model
    : HOSTED_MODELS[0];

  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    if (!initial || initial.provider !== next) setModel(DEFAULT_MODELS[next]);
  };

  /**
   * Hosted and BYOK are the top-level choice; which company serves the tokens
   * is a detail below it, not a peer. Remembering the last BYOK provider means
   * looking at hosted and coming back doesn't silently reset someone's setup.
   */
  const handleModeChange = (next: 'hosted' | 'byok') => {
    if (next === 'hosted') handleProviderChange('hosted');
    else handleProviderChange(lastByokProvider);
  };

  /** Hosted has no other input, so signing in *is* completing setup. Persisted
   * without closing the panel: the user still sees the result of what they did. */
  const persistHosted = useCallback(() => {
    void onSave({ provider: 'hosted', model: HOSTED_MODELS[0] });
  }, [onSave]);

  const handleLanguageChange = (next: LocalePreference) => {
    void setPreference(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Hosted stores no base URL of its own — providers.ts reads the constant.
      // Dropping it also clears anything a previous BYOK setup left behind,
      // which would otherwise silently redirect hosted traffic.
      const trimmedBaseURL = hosted ? undefined : baseURL.trim() || undefined;
      await ensureHostPermission(trimmedBaseURL ?? (hosted ? HOSTED_BASE_URL : undefined), (origin) =>
        t('settings.permissionDenied', { origin }),
      );
      await onSave({
        provider,
        // Hosted has no user-held key; storing an empty string would only make
        // the settings look half-filled to anything that reads them later.
        apiKey: hosted ? undefined : apiKey.trim(),
        model: hosted ? hostedModel : model.trim(),
        baseURL: trimmedBaseURL,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const baseUrlHint =
    provider === 'deepseek'
      ? t('settings.baseUrlHint.deepseek', { url: DEEPSEEK_BASE_URL })
      : provider === 'openai'
        ? t('settings.baseUrlHint.openai')
        : t('settings.baseUrlHint.other');

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-3 backdrop-blur-sm">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.015em] text-fg">
          {t('settings.title')}
        </h2>
        {!firstRun && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t('settings.close')}
            title={t('settings.close')}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pt-3 pb-4">
        {firstRun && (
          <p className="rounded-lg border border-accent-line bg-accent-soft px-2.5 py-2 text-[12px] leading-[1.45] text-fg">
            {t('settings.intro')}
          </p>
        )}

        <Section icon={Languages} title={t('settings.sectionGeneral')}>
          <Field label={t('settings.language')} hint={t('settings.languageHint')} htmlFor="language">
            <Select value={preference} onValueChange={(v) => handleLanguageChange(v as LocalePreference)}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('settings.language.system')}</SelectItem>
                <SelectItem value="en">{t('settings.language.en')}</SelectItem>
                <SelectItem value="zh">{t('settings.language.zh')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section icon={Sparkles} title={t('settings.sectionModel')}>
          {/* The product's top-level choice: sign in and use it, or wire up your
              own provider. Which company serves the tokens is a detail *inside*
              the second answer, not a peer of it — listing five providers flat
              made BYOK look like the main path. */}
          <Field label={t('settings.mode')} hint={t(hosted ? 'settings.mode.hostedHint' : 'settings.mode.byokHint')} htmlFor="mode">
            <Select value={hosted ? 'hosted' : 'byok'} onValueChange={(v) => handleModeChange(v as 'hosted' | 'byok')}>
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hosted">{t('settings.mode.hosted')}</SelectItem>
                <SelectItem value="byok">{t('settings.mode.byok')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {!hosted && (
        <Section icon={KeyRound} title={t('settings.sectionByok')}>
          <Field label={t('settings.provider')} htmlFor="provider">
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as ProviderId)}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={t('settings.apiKey')}
            hint={t('settings.apiKeyHint')}
            htmlFor="apiKey"
            trailing={
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="grid size-6 cursor-pointer place-items-center rounded-md text-fg-tertiary outline-none transition-colors duration-200 hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-line"
                aria-label={showKey ? t('settings.hideKey') : t('settings.showKey')}
                title={showKey ? t('settings.hideKey') : t('settings.showKey')}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            }
          >
            <Input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              className="font-mono text-[12px] tracking-tight"
            />
          </Field>

          <Field label={t('settings.model')} htmlFor="model">
            <Input
              id="model"
              type="text"
              spellCheck={false}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              className="font-mono text-[12px] tracking-tight"
            />
          </Field>

          <Field
            label={t('settings.baseUrlOptional')}
            badge={provider === 'openai-compatible' ? undefined : t('settings.optional')}
            hint={baseUrlHint}
            htmlFor="baseURL"
          >
            <Input
              id="baseURL"
              type="url"
              spellCheck={false}
              placeholder={provider === 'deepseek' ? DEEPSEEK_BASE_URL : 'https://…'}
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              className="font-mono text-[12px] tracking-tight"
            />
          </Field>
        </Section>
        )}

        {/* Hosted's only input is an account. The model comes from the plan and
            the endpoint is ours — exposing either would only be a way to get
            them wrong. When plans offer a choice of models (PLAN-subscription
            §7 Phase 4), that picker belongs here. */}
        {hosted && (
        <Section icon={KeyRound} title={t('settings.sectionAccount')}>
          <AccountField onSignedIn={persistHosted} />
        </Section>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-negative-line bg-negative-soft px-2.5 py-2 text-[11.5px] leading-[1.45] text-negative"
          >
            {error}
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-t border-line bg-surface/90 px-3 py-2.5 backdrop-blur-sm',
          firstRun && 'pb-3',
        )}
      >
        <Button type="submit" disabled={saving || !apiKey.trim() || !model.trim()} className="min-w-[72px]">
          {saving ? t('settings.saving') : t('settings.save')}
        </Button>
        {!firstRun && (
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('settings.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
