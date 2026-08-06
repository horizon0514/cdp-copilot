import type { Metadata } from 'next';
import { LangSwitch } from '@/components/lang-switch';
import { Footer, GITHUB_URL, Grain, Nav, SITE_URL } from '@/components/site';

export const metadata: Metadata = {
  title: '隐私政策 — Pagehand',
  description: 'Pagehand Chrome 扩展的隐私政策。',
  alternates: {
    canonical: `${SITE_URL}/zh/privacy`,
    languages: {
      en: `${SITE_URL}/privacy`,
      'zh-CN': `${SITE_URL}/zh/privacy`,
      'x-default': `${SITE_URL}/privacy`,
    },
  },
};

export default function ZhPrivacy() {
  return (
    <>
      <Grain />

      <div className="wrap">
        <Nav
          navLabel="主导航"
          brandHref="/zh"
          langSwitch={<LangSwitch label="语言" current="zh" enHref="/privacy" zhHref="/zh/privacy" />}
        >
          <a href="/zh">首页</a>
        </Nav>

        <article className="legal">
          <h1>隐私政策</h1>
          <p className="updated">最近更新：2026 年 8 月 3 日</p>

          <p>
            Pagehand（「本扩展」）是一款 Chrome 扩展，帮助你通过 Chrome DevTools Protocol
            读取并自动化当前网页。本政策说明本扩展会处理哪些数据，以及它<em>不会</em>做什么。
          </p>

          <h2>1. 没有 Pagehand 后端</h2>
          <p>
            Pagehand 不运营任何会接收你的对话、页面内容或 API 密钥的云服务。 没有 Pagehand
            账号系统，也没有 Pagehand 分析 / 遥测端点。
          </p>

          <h2>2. 存储在你设备上的数据</h2>
          <p>本扩展会将以下内容保存在你的 Chrome 配置中：</p>
          <ul>
            <li>
              <strong>LLM 设置</strong> — 提供商选择、模型名称、Base URL （如有自定义）以及 API
              密钥，保存在 <code>chrome.storage.local</code>。 密钥以未加密形式存放在浏览器配置中，不会通过
              Chrome Sync 同步到你的 Google 账号。
            </li>
            <li>
              <strong>对话线程</strong> — 对话历史（包括线程中保留的截图）保存在本机 IndexedDB。
            </li>
            <li>
              <strong>语言偏好</strong> — 你选择的界面语言。
            </li>
          </ul>

          <h2>3. 经网络发送的数据</h2>
          <p>
            当你与 Agent 对话时，提示词、来自页面的上下文（例如无障碍树快照、控制台 /
            网络摘录，以及你要求拍摄的截图）和工具结果，会发送到
            <em>你</em>配置的大语言模型提供商 — 例如 DeepSeek、OpenAI、Anthropic，
            或其他 OpenAI 兼容端点。Pagehand 不会插入代理；请求从你的浏览器直达该提供商。
          </p>
          <p>数据到达提供商后，受其各自隐私政策约束。</p>

          <h2>4. 权限与网页访问</h2>
          <p>
            Pagehand 使用 Chrome 的 <code>debugger</code> 权限（Chrome DevTools Protocol）
            来检查并控制已附着的网页。附着期间，Chrome 会显示持久横幅：
            「Pagehand is debugging this browser。」该横幅是 Chrome 安全机制，本扩展无法关闭。
          </p>
          <p>
            默认主机权限仅限内置提供商 API 主机。广泛站点访问 （<code>https://*/*</code>、
            <code>http://localhost/*</code>） 为可选，仅在需要时请求（例如自定义提供商 Base URL）。
          </p>

          <h2>5. 我们不收集的内容</h2>
          <ul>
            <li>不会向 Pagehand 发送崩溃报告或使用分析</li>
            <li>没有广告标识符</li>
            <li>不会出售个人信息</li>
          </ul>

          <h2>6. 儿童</h2>
          <p>本扩展不面向 13 岁以下儿童，我们也不会故意收集儿童的个人信息。</p>

          <h2>7. 变更</h2>
          <p>
            若本政策发生实质性变更，上方「最近更新」日期将随之修订。
            更新后继续使用本扩展，即表示你接受修订后的政策。
          </p>

          <h2>8. 联系</h2>
          <p>
            关于本政策的问题：请在 <a href={GITHUB_URL}>GitHub</a> 上提交
            issue，或联系该仓库中列出的维护者邮箱。
          </p>
        </article>
      </div>

      <Footer navLabel="页脚">
        <a href="/zh">首页</a>
      </Footer>
    </>
  );
}
