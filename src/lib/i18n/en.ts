/** English UI copy. Keys are shared with `zh.ts` — keep them in sync. */
export const en = {
  // App shell / composer
  'app.loading': 'Loading',
  'app.settings': 'Settings',
  'app.toolbar': 'Chat actions',
  'app.message': 'Message',
  'composer.placeholder': 'Ask anything — @ to reference a tab',
  'composer.placeholderStreaming': 'Type to redirect the agent…',
  'composer.sendAction': 'send',
  'composer.newlineAction': 'newline',
  'composer.takesOver': 'Takes over',
  'composer.agentRunning': 'Agent running',
  'composer.redirectAction': 'redirect',
  'composer.stopAction': 'stop',
  'composer.stop': 'Stop the agent',
  'composer.stopTitle': 'Stop (Esc)',
  'composer.sendLabel': 'Send',
  'composer.sendTakeover': 'Send, taking over from the agent',
  'composer.selectionPrompt': 'Regarding this selected text: "{text}"\n',

  // Empty state
  'empty.title': 'Ask about this page',
  'empty.body': 'Read the DOM, inspect console and network, or drive the page with clicks and typing.',
  'empty.tryOne': 'Try one',
  'empty.suggest.summarize': 'Summarize this page',
  'empty.suggest.clickLogin': 'Click the login button',
  'empty.suggest.console': 'What errors are in the console?',

  // Threads
  'thread.newChat': 'New chat',
  'thread.history': 'Chat history',
  'thread.historyClose': 'Close chat history',
  'thread.chats': 'Chats',
  'thread.sessions': 'Chat sessions',
  'thread.empty': 'No chats yet.\nSend a message to start one.',

  // Bound tab bar
  'bound.badgeBound': 'Bound',
  'bound.badgeActive': 'active',
  'bound.drifted': "Acting on {bound} — you're viewing {viewing}",
  'bound.switchHere': 'Switch here',
  'bound.switching': 'Switching…',
  'bound.stopFirst': 'Stop the agent first',
  'bound.moveTo': 'Move the agent to {host}',

  // Mentions
  'mention.title': 'Reference a tab',
  'mention.hints': '↑↓ move · ↵ pick · esc close',
  'mention.bound': 'bound',

  // Messages
  'message.thinking': 'Thinking',
  'message.continue': 'Continue',
  'message.retry': 'Retry',
  'message.continuePrompt': 'Continue where you left off.',
  'message.screenshot': 'Screenshot',
  'message.steps': '{count} step',
  'message.steps_plural': '{count} steps',
  'message.tokens': '{count} tokens',
  'message.stop.aborted':
    'Stopped by you. What finished before the stop is kept — send another message to pick it back up.',
  'message.stop.stepLimit':
    'Hit the {steps}-step limit — the model was still working. Ask it to continue, or narrow the task.',
  'message.stop.length': 'The model hit its output token limit mid-response.',
  'message.stop.contentFilter': 'The provider blocked the response (content filter).',
  'message.stop.noAnswer':
    'The model ran tools but returned no answer. Often means the context filled up — try a narrower ask.',
  'message.stop.early': 'Model stopped early (finishReason: {reason}).',

  // Tools
  'tools.count': '{count} tools',
  'tools.done': 'Done',
  'tools.running': 'Running',
  'tools.failed': 'Failed',
  'tools.stopped': 'Stopped',
  'tools.arguments': 'Arguments',
  'tools.result': 'Result',
  'tools.error': 'Error',
  'tools.preview': 'Preview',
  'tools.images': '{count} img',
  'tools.stoppedBeforeResult': 'Stopped before this tool reported back.',
  'tools.moreLines': '… {count} lines above',
  'tools.showAll': 'Show all',
  'tools.showLess': 'Show less',

  // Settings
  'settings.title': 'Settings',
  'settings.sectionByok': 'Your provider',
  'settings.hosted': 'Pagehand',
  'settings.switchToByok': 'Use your own API key instead',
  'settings.switchToHosted': '← Back to Pagehand',
  'settings.done': 'Done',

  // Sign-in screen
  'auth.title': 'Sign in to Pagehand',
  'auth.subtitle': 'One account, and the model is handled for you.',
  'auth.emailLabel': 'Email address',
  'auth.continue': 'Continue with email',
  'auth.linkHint': 'We’ll email you a link. No password to pick or remember.',
  'auth.or': 'or',
  'auth.checkEmail': 'Check your email',
  'auth.sentTo': 'We sent a sign-in link to {email}.',
  'auth.sentHint': 'Open it in this browser — the link signs in whichever one opens it.',
  'auth.useAnother': 'Use a different email',

  // Composer sign-in gate
  'auth.signedOut': 'Signed out — sign in to keep using Pagehand.',
  'auth.signIn': 'Sign in',

  'account.sending': 'Sending…',
  'account.timedOut': 'That link expired before it was opened. Send another.',
  'account.signOut': 'Sign out',
  'account.signedIn': 'Signed in',
  'settings.language': 'Language',
  'settings.language.system': 'System default',
  'settings.language.en': 'English',
  'settings.language.zh': '中文',
  'settings.provider': 'Provider',
  'settings.apiKey': 'API key',
  'settings.apiKeyHint': 'Local only — never synced.',
  'settings.showKey': 'Show API key',
  'settings.hideKey': 'Hide API key',
  'settings.model': 'Model',
  'settings.baseUrl': 'Base URL',
  'settings.baseUrlOptional': 'Base URL',
  'settings.optional': 'Optional',
  'settings.baseUrlHint.deepseek': 'Empty → {url}. Custom hosts need a one-time permission.',
  'settings.baseUrlHint.openai': 'Must expose /responses. Custom hosts need a one-time permission.',
  'settings.baseUrlHint.other': 'OpenRouter, Azure, Ollama, etc. — needs a one-time permission.',
  'settings.save': 'Save',
  'settings.saving': 'Saving…',
  'settings.cancel': 'Cancel',
  'settings.close': 'Close settings',
  'settings.permissionDenied': "Permission for {origin} was not granted — can't use this endpoint.",

  // Task ledger
  'ledger.title': 'Task ledger',
  'ledger.planProgress': '{done}/{total} steps',
  'ledger.findingsCount': '{count} findings',
  'ledger.plan': 'Plan',
  'ledger.findings': 'Findings',
  'ledger.notes': 'Handoff notes',
  'ledger.copy': 'Copy findings as Markdown',
  'ledger.copied': 'Copied',
  'ledger.expand': 'Show task ledger',
  'ledger.collapse': 'Hide task ledger',

  // Context menus (also used from the background service worker)
  'menu.askPage': 'Ask AI about this page',
  'menu.askSelection': 'Ask AI about selection',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
