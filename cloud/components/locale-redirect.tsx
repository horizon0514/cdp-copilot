import { LOCALE_STORAGE_KEY } from './lang-switch';

/**
 * Sends a reader whose browser prefers Chinese to /zh before anything paints.
 *
 * Deliberately not middleware: the saved choice lives in localStorage, which the
 * server cannot read, and an explicit choice has to beat the browser's default.
 * Rendered as the first thing in the page body so the parser executes it before
 * laying out any English copy.
 *
 * Home page only. On /privacy this would bounce readers to the /zh *home* page
 * rather than the policy they asked for, which is why it is a component rather
 * than something in the root layout.
 */
const SCRIPT = `(function () {
  try {
    var saved = localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});
    var preferZh =
      saved === "zh" ||
      (saved !== "en" &&
        (navigator.languages || [navigator.language || "en"]).some(function (l) {
          return String(l).toLowerCase().indexOf("zh") === 0;
        }));
    if (preferZh) location.replace("/zh" + location.search + location.hash);
  } catch (_) {}
})();`;

export function LocaleRedirect() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
