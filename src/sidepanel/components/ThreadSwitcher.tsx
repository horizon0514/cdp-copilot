import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, MessageSquarePlus, MessagesSquare, SlidersHorizontal, SquarePen, X } from 'lucide-react';
import { Button } from './ui/button';
import HeaderIconButton from './HeaderIconButton';
import { cn } from '../lib/utils';
import { useI18n, useT } from '../i18n/useT';
import type { ThreadSummary } from '../state/conversationStore';
import type { Locale } from '../../lib/i18n';
import { isUntitledThreadTitle } from '../../lib/storage/chatThreads';

const ICON_STROKE = 1.75;

function formatWhen(ts: number, locale: Locale): string {
  const tag = locale === 'zh' ? 'zh-CN' : 'en';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(tag, { month: 'short', day: 'numeric' });
}

function displayThreadTitle(
  title: string | undefined,
  t: (key: 'thread.newChat') => string,
): string {
  return isUntitledThreadTitle(title) ? t('thread.newChat') : title!;
}

export default function ThreadSwitcher({
  threadId,
  threadList,
  isStreaming,
  blocked = false,
  settingsOpen = false,
  onToggleSettings,
  onNewChat,
  onSwitch,
}: {
  threadId: string;
  threadList: ThreadSummary[];
  isStreaming: boolean;
  /** Hide/close the history sheet (e.g. while settings is open). */
  blocked?: boolean;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  onNewChat: () => void;
  onSwitch: (id: string) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = threadList.find((row) => row.id === threadId);
  const title = displayThreadTitle(current?.title, t);
  const sheetOpen = open && !blocked;

  useEffect(() => {
    setShell(document.querySelector<HTMLElement>('[data-app-shell]'));
  }, []);

  useEffect(() => {
    if (blocked) setOpen(false);
  }, [blocked]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    queueMicrotask(() => closeRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const startNew = () => {
    setOpen(false);
    onNewChat();
  };

  const sheet =
    sheetOpen &&
    shell &&
    createPortal(
      <div
        id="chat-history-sheet"
        className="animate-enter absolute inset-x-0 top-10 bottom-0 z-50 flex flex-col bg-bg"
        role="dialog"
        aria-modal="true"
        aria-label={t('thread.history')}
      >
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3">
          <span className="text-[12.5px] font-medium text-fg">{t('thread.chats')}</span>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('thread.historyClose')}
            onClick={() => setOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <div className="shrink-0 border-b border-line p-2.5">
          <button
            type="button"
            disabled={isStreaming}
            onClick={startNew}
            className={cn(
              'flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-[12.5px] font-medium text-fg outline-none transition-colors duration-200',
              'hover:border-line-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent-line',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent-text">
              <MessageSquarePlus className="size-3.5" />
            </span>
            {t('thread.newChat')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox" aria-label={t('thread.sessions')}>
          {threadList.length === 0 ? (
            <div className="whitespace-pre-line px-2 py-8 text-center text-[12px] leading-[1.5] text-fg-tertiary">
              {t('thread.empty')}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {threadList.map((thread) => {
                const active = thread.id === threadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={isStreaming}
                    onClick={() => {
                      setOpen(false);
                      onSwitch(thread.id);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2.5 text-left outline-none transition-colors duration-150',
                      'hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent-line',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      active && 'bg-accent-soft ring-1 ring-accent-line',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'truncate text-[12.5px] leading-[1.35]',
                          active ? 'font-medium text-fg' : 'text-fg',
                        )}
                      >
                        {displayThreadTitle(thread.title, t)}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-fg-tertiary">
                        {formatWhen(thread.updatedAt, locale)}
                      </div>
                    </div>
                    {active && <Check className="mt-0.5 size-3.5 shrink-0 text-accent-text" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>,
      shell,
    );

  return (
    <>
      {/* Title is display-only — history is an explicit action, not a fake select. */}
      <h1 className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.015em] text-fg" title={title}>
        {title}
      </h1>

      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 rounded-[10px] border border-line bg-bg/70 p-0.5',
          'shadow-[inset_0_1px_0_rgba(232,239,230,0.04)]',
        )}
        role="toolbar"
        aria-label={t('app.toolbar')}
      >
        <HeaderIconButton
          active={sheetOpen}
          disabled={isStreaming || blocked}
          aria-label={t('thread.history')}
          aria-expanded={sheetOpen}
          aria-controls="chat-history-sheet"
          title={t('thread.history')}
          onClick={() => setOpen((v) => !v)}
        >
          <MessagesSquare className="size-[15px]" strokeWidth={ICON_STROKE} />
        </HeaderIconButton>

        <HeaderIconButton
          emphasize
          disabled={isStreaming || blocked}
          aria-label={t('thread.newChat')}
          title={t('thread.newChat')}
          onClick={startNew}
        >
          <SquarePen className="size-[15px]" strokeWidth={ICON_STROKE} />
        </HeaderIconButton>

        <span className="mx-0.5 h-3.5 w-px shrink-0 bg-line-strong/90" aria-hidden />

        <HeaderIconButton
          active={settingsOpen}
          disabled={isStreaming}
          aria-label={t('app.settings')}
          aria-pressed={settingsOpen}
          title={t('app.settings')}
          onClick={onToggleSettings}
        >
          <SlidersHorizontal className="size-[15px]" strokeWidth={ICON_STROKE} />
        </HeaderIconButton>
      </div>

      {sheet}
    </>
  );
}
