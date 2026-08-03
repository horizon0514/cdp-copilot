import { describe, expect, it } from 'vitest';
import { en } from './en';
import { zh } from './zh';
import { resolveLocale, translate, translatePlural } from './index';

describe('i18n catalogs', () => {
  it('keeps en and zh keys aligned', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
});

describe('translate', () => {
  it('interpolates vars', () => {
    expect(translate('en', 'bound.moveTo', { host: 'v2ex.com' })).toBe(
      'Move the agent to v2ex.com',
    );
    expect(translate('zh', 'bound.moveTo', { host: 'v2ex.com' })).toBe(
      '将 Agent 移到 v2ex.com',
    );
  });
});

describe('translatePlural', () => {
  it('uses the English plural form when count ≠ 1', () => {
    expect(translatePlural('en', 'message.steps', 1)).toBe('1 step');
    expect(translatePlural('en', 'message.steps', 3)).toBe('3 steps');
    expect(translatePlural('zh', 'message.steps', 3)).toBe('3 步');
  });
});

describe('resolveLocale', () => {
  it('honours an explicit preference', () => {
    expect(resolveLocale('zh')).toBe('zh');
    expect(resolveLocale('en')).toBe('en');
  });
});
