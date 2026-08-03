import { peekPageText, type TabMention } from './tabMentions';
import { getBoundTabId } from '../tools/context';

/**
 * Quietly read text from @-mentioned tabs that aren't already the bound one.
 * Keeps boundTabId untouched; peekPageText restores the prior debugger attach.
 */
export async function peekMentionedTabs(
  mentions: TabMention[],
): Promise<Map<number, string | null>> {
  const bound = getBoundTabId();
  const peeks = new Map<number, string | null>();

  for (const mention of mentions) {
    if (mention.pageId === bound) {
      // Bound tab tools can read it live; no need to snapshot up front.
      continue;
    }
    peeks.set(mention.pageId, await peekPageText(mention.pageId));
  }

  return peeks;
}
