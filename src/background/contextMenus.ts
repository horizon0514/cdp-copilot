import { resolveLocale, translate, type LocalePreference } from '../lib/i18n';
import { getLocalePreference, onLocalePreferenceChanged } from '../lib/i18n/localeStore';

const MENU_ASK_PAGE = 'pagehand-ask-page';
const MENU_ASK_SELECTION = 'pagehand-ask-selection';

async function applyMenuTitles(pref: LocalePreference): Promise<void> {
  const locale = resolveLocale(pref);
  await Promise.all([
    chrome.contextMenus.update(MENU_ASK_PAGE, {
      title: translate(locale, 'menu.askPage'),
    }),
    chrome.contextMenus.update(MENU_ASK_SELECTION, {
      title: translate(locale, 'menu.askSelection'),
    }),
  ]).catch(() => {
    // Menus may not exist yet on the first storage event before install finishes.
  });
}

export async function installContextMenus(): Promise<void> {
  const pref = await getLocalePreference();
  const locale = resolveLocale(pref);

  // onInstalled also fires on update; recreate so titles match the current locale.
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ASK_PAGE,
    title: translate(locale, 'menu.askPage'),
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: MENU_ASK_SELECTION,
    title: translate(locale, 'menu.askSelection'),
    contexts: ['selection'],
  });
}

export function watchContextMenuLocale(): void {
  onLocalePreferenceChanged((pref) => {
    void applyMenuTitles(pref);
  });
}
