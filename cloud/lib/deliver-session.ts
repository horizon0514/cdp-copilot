'use client';

import type { Session } from '@supabase/supabase-js';

/**
 * Handing a finished sign-in to the extension.
 *
 * `chrome.runtime.sendMessage` is available to this page only because the
 * extension's manifest lists this origin under `externally_connectable`; on any
 * other site the API simply isn't there. That is the entire trust model, and it
 * is enforced by Chrome rather than by anything we can get wrong here.
 *
 * Several ids are tried because an unpacked development build and a published
 * one have different ids, and only one of them is installed at a time.
 */

interface ChromeRuntime {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response?: { ok?: boolean }) => void,
  ) => void;
  lastError?: { message?: string };
}

function runtime(): ChromeRuntime | null {
  const chrome = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome;
  return chrome?.runtime?.sendMessage ? chrome.runtime : null;
}

function extensionIds(): string[] {
  return (process.env.NEXT_PUBLIC_EXTENSION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function send(rt: ChromeRuntime, id: string, session: Session): Promise<boolean> {
  return new Promise((resolve) => {
    rt.sendMessage(
      id,
      {
        type: 'pagehand:session',
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
          ...(session.user?.email ? { email: session.user.email } : {}),
        },
      },
      (response) => {
        // Messaging an extension that isn't installed sets lastError instead of
        // throwing; reading it is also what stops Chrome logging it as unchecked.
        resolve(!rt.lastError && response?.ok === true);
      },
    );
  });
}

export type DeliveryResult = 'delivered' | 'no-extension';

export async function deliverSession(session: Session): Promise<DeliveryResult> {
  const rt = runtime();
  if (!rt) return 'no-extension';

  for (const id of extensionIds()) {
    if (await send(rt, id, session)) return 'delivered';
  }
  return 'no-extension';
}
