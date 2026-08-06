# Chrome Web Store listing — Pagehand

Privacy policy URL: https://pagehand.app/privacy  
Homepage URL: https://pagehand.app  
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
Privacy policy: https://pagehand.app/privacy
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
隐私政策：https://pagehand.app/privacy
```

## Store category & metadata

- Primary category: **Productivity** (alt: Developer Tools)
- Language: English (primary), Chinese (China) via `_locales`
- Single purpose: Help users read and automate the current browser tab with an on-device AI side panel over CDP.

## Privacy practices (dashboard — copy/paste)

Path: Developer Dashboard → your item → **Privacy practices**

Privacy policy URL:

```
https://pagehand.app/privacy
```

### Single purpose description

```
Help users read and automate the current browser tab with an on-device AI side panel over the Chrome DevTools Protocol. Users bring their own LLM API key; there is no Pagehand cloud backend.
```

### Remote code

Select: **No, I am not using remote code**

(Justification field leave blank / N/A. The extension only talks to LLM APIs the user configures; it never downloads or evaluates remote JS.)

### Data collection — check these boxes

Disclose handling even when data stays local or goes only to the user’s chosen LLM provider (not a Pagehand server).

| Data type | Check? | Why |
|-----------|--------|-----|
| Personally identifiable information | **Yes** | API keys stored in `chrome.storage.local`; prompts / page text sent to the user’s LLM may include names, emails, etc. |
| Health information | No | |
| Financial and payment information | **Yes** | User may ask the agent to fill payment forms or summarize checkout pages; form values and page text can include card/payment details |
| Authentication information | **Yes** | User-supplied LLM API keys (and optionally custom provider credentials) are stored locally and sent to that provider |
| Personal communications | No | |
| Location | No | |
| Web history | **Yes** | Bound-tab URL/title, `@` tab mentions, and network request URLs/metadata used for agent context |
| User activity | **Yes** | Chat messages, tool calls, console messages captured while attached |
| Website content | **Yes** | Accessibility snapshots, DOM-derived form values, screenshots, and page text sent to the configured LLM |

If the dashboard uses slightly different labels, map: **Website content** / **Form data** / **Web browsing activity** → yes; ads/location/health → no.

### Data usage certifications — check ALL

- [x] I do **not** sell or transfer user data to third parties, outside of the approved use cases
- [x] I do **not** use or transfer user data for purposes that are unrelated to my item’s single purpose
- [x] I do **not** use or transfer user data to determine creditworthiness or for lending purposes

Note for reviewers (optional if there’s a free-text box): Pagehand has no backend. Data leaves the device only as HTTPS requests from the browser to the LLM provider the user configured (DeepSeek / OpenAI / Anthropic / custom OpenAI-compatible URL).

### Permission justifications (one field per permission)

**sidePanel**
```
The chat UI and agent loop run in Chrome’s side panel so the user can talk to the AI while viewing the page.
```

**debugger**
```
Required to speak Chrome DevTools Protocol (Accessibility, DOM, Input, Page, Network, Log, Runtime) so the agent can snapshot the page, click/fill, and inspect console/network on the attached tab. Chrome shows the “debugging this browser” banner while attached.
```

**tabs**
```
Identify which tab to attach, show bound-tab status, and support @-mentions of other open tabs as context.
```

**activeTab**
```
Access the tab the user is interacting with when they open the side panel or use the context menu, without requesting broad permanent access to every site.
```

**storage**
```
Persist LLM settings (provider, model, API key), UI locale, and related preferences in chrome.storage.local on this device only (not Chrome Sync).
```

**contextMenus**
```
Provide “ask about this page / selection” entries so users can send page context into the side panel chat.
```

**scripting**
```
Inject a temporary screenshot lightbox overlay onto the page tab so images from the chat can be viewed full-viewport.
```

**Host permission: https://api.deepseek.com/***
```
Default DeepSeek API endpoint for chat completions when the user selects DeepSeek and supplies their own key.
```

**Host permission: https://api.openai.com/***
```
Default OpenAI API endpoint when the user selects OpenAI and supplies their own key.
```

**Host permission: https://api.anthropic.com/***
```
Default Anthropic API endpoint when the user selects Anthropic and supplies their own key.
```

**Optional host permission: https://*/* and http://localhost/***
```
Requested only at runtime when the user configures a custom OpenAI-compatible base URL or needs page-origin access for features like the screenshot lightbox on that site. Not granted at install by default.
```

If the dashboard collapses hosts into one field:
```
Default hosts are the built-in LLM providers (DeepSeek, OpenAI, Anthropic). Broader https://*/* and localhost are optional and requested only when the user sets a custom provider URL or needs on-page overlay injection.
```

## Assets checklist

| Asset | Path | Size |
|-------|------|------|
| Extension icons | `public/icons/icon{16,32,48,128}.png` | required by manifest |
| Store icon | `store/assets/icon-128.png` | 128×128 |
| Small promo | `store/assets/promo-small-440x280.png` | 440×280 |
| Marquee promo | `store/assets/promo-marquee-1400x560.png` | 1400×560 |
| Screenshot 1 (upload first) | `store/assets/screenshot-1280x800.png` | 1280×800 — Automate |
| Screenshot 2 | `store/assets/screenshot-inspect-1280x800.png` | 1280×800 — Read / CDP |
| Screenshot 3 | `store/assets/screenshot-private-1280x800.png` | 1280×800 — BYO key |
| Screenshot (small) | `store/assets/screenshot-640x400.png` | 640×400 — Automate |
| ZH Screenshot 1 | `store/assets/screenshot-zh-1280x800.png` | 1280×800 — 自动操作 |
| ZH Screenshot 2 | `store/assets/screenshot-zh-inspect-1280x800.png` | 1280×800 — 读懂页面 |
| ZH Screenshot 3 | `store/assets/screenshot-zh-private-1280x800.png` | 1280×800 — 自备密钥 |
| ZH Screenshot (small) | `store/assets/screenshot-zh-640x400.png` | 640×400 — 自动操作 |

Upload English shots under the default locale; upload `screenshot-zh-*.png` under **Chinese (China)** locale screenshots.

Regenerate after editing `store/screenshot-mock.html`:

```bash
npm run store:shots
```

## Upload steps

1. `npm run pack` → `pagehand.zip`
2. Developer Dashboard → New item → upload zip
3. Paste listing copy + privacy URL
4. Upload promo images + screenshots from `store/assets/`
5. Complete privacy questionnaire
6. Submit for review
