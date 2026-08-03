# Chrome Web Store listing — Pagehand

Privacy policy URL: https://pagehand.vercel.app/privacy  
Homepage URL: https://pagehand.vercel.app  
Support / GitHub: https://github.com/horizon0514/pagehand

## Names

| Field | Value |
|-------|--------|
| Extension name | Pagehand |
| Package | `pagehand.zip` via `npm run pack` |

## Short description (≤132 characters)

```
AI that reads and automates the current tab via the Chrome DevTools Protocol. BYO API key.
```

(99 chars)

## Detailed description

```
Pagehand is an AI side-panel for Chrome that can read and drive the tab you’re on — through the Chrome DevTools Protocol, not a brittle DOM scraper.

Bring your own API key (DeepSeek, OpenAI, Anthropic, or any OpenAI-compatible endpoint). There is no Pagehand cloud: chats and keys stay in your browser profile, and model requests go only to the provider you configure.

What it can do
• Summarize and explain the current page
• Click, type, and fill forms
• Inspect console errors and network requests
• Take screenshots and keep them in the chat
• Work from a keyboard shortcut (Ctrl/Cmd+Shift+K)

How it works
The side panel owns the debugger session for the attached tab. Tools like take_snapshot, click, fill, navigate_page, and list_network_requests talk CDP domains (Accessibility, DOM, Input, Page, Network, Log, Runtime) — the same protocol Puppeteer uses.

Privacy
• API keys are stored locally in chrome.storage.local (not synced)
• No Pagehand backend, accounts, or telemetry
• While attached, Chrome shows “Pagehand is debugging this browser” — a built-in safety banner that cannot be hidden

Open source: https://github.com/horizon0514/pagehand
Privacy policy: https://pagehand.vercel.app/privacy
```

## Chinese detailed description (optional locale)

```
Pagehand 是 Chrome 侧栏里的 AI 助手：通过 Chrome DevTools Protocol 读取并操作当前标签页。

自备 API Key（DeepSeek / OpenAI / Anthropic，或任意 OpenAI 兼容接口）。没有 Pagehand 云端——密钥与对话留在本机，请求只发往你配置的模型服务商。

能做什么
• 总结、解释当前页面
• 点击、输入、填写表单
• 查看控制台错误与网络请求
• 截图并保存在对话里
• 快捷键 Ctrl/Cmd+Shift+K 打开侧栏

隐私
• API Key 仅存在 chrome.storage.local，不会通过 Chrome 同步
• 无自有后端、账号或遥测
• 附着标签页时，Chrome 会显示「Pagehand is debugging this browser」横幅（系统安全提示，无法关闭）

开源：https://github.com/horizon0514/pagehand
隐私政策：https://pagehand.vercel.app/privacy
```

## Store category & metadata

- Primary category: **Productivity** (alt: Developer Tools)
- Language: English (primary), Chinese (China) via `_locales`
- Single purpose: Help users read and automate the current browser tab with an on-device AI side panel over CDP.

## Privacy practices (dashboard questionnaire)

| Question | Answer |
|----------|--------|
| Collects user data? | Yes — only what you send to your chosen LLM provider (prompts + page-derived context). Not collected by Pagehand servers. |
| Personally identifiable info | API key stored locally; not transmitted to Pagehand |
| Remote code | No |
| Sold data | No |
| Used for purposes unrelated to core | No |
| Privacy policy | https://pagehand.vercel.app/privacy |

Permissions justification (paste into dashboard as needed):

- `sidePanel` — chat UI lives in the side panel  
- `debugger` — CDP access to read/automate the attached tab  
- `tabs` / `activeTab` — know which tab to attach; optional tab mentions  
- `storage` — settings, locale, chat history  
- `contextMenus` — “ask about page / selection”  
- `scripting` — screenshot lightbox on the page tab  
- Host permissions for `api.deepseek.com`, `api.openai.com`, `api.anthropic.com` — default providers; broader hosts optional at runtime  

## Assets checklist

| Asset | Path | Size |
|-------|------|------|
| Extension icons | `public/icons/icon{16,32,48,128}.png` | required by manifest |
| Store icon | `store/assets/icon-128.png` | 128×128 |
| Small promo | `store/assets/promo-small-440x280.png` | 440×280 |
| Marquee promo | `store/assets/promo-marquee-1400x560.png` | 1400×560 |
| Screenshot(s) | `store/assets/screenshot-*.png` | 1280×800 or 640×400 |

## Upload steps

1. `npm run pack` → `pagehand.zip`
2. Developer Dashboard → New item → upload zip
3. Paste listing copy + privacy URL
4. Upload promo images + screenshots from `store/assets/`
5. Complete privacy questionnaire
6. Submit for review
