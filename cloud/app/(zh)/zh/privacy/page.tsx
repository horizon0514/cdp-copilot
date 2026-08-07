import type { Metadata } from 'next';
import { LangSwitch } from '@/components/lang-switch';
import { CONTACT_EMAIL, Footer, GITHUB_URL, Grain, Nav, SITE_URL } from '@/components/site';

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
          githubLabel="在 GitHub 上查看 Pagehand"
          langSwitch={<LangSwitch label="语言" current="zh" enHref="/privacy" zhHref="/zh/privacy" />}
        >
          <a href="/zh">首页</a>
        </Nav>

        <article className="legal">
          <h1>隐私政策</h1>
          <p className="updated">最近更新：2026 年 8 月 6 日</p>

          <p>
            Pagehand（「本扩展」）是一款 Chrome 扩展，帮助你通过 Chrome DevTools Protocol
            读取并自动化当前网页。本政策说明本扩展会处理哪些数据，以及它<em>不会</em>做什么。
          </p>

          <h2>1. 触达模型的两条路径</h2>
          <p>
            你用哪一条，决定了 Pagehand 的服务器是否会看到任何东西。两种模式下，Agent
            循环和所有页面工具都在本扩展内部运行，对话线程也只保存在你的设备上。
          </p>
          <ul>
            <li>
              <strong>托管模式（默认）</strong> — 你用邮箱登录，模型调用由本扩展发往 Pagehand 位于{' '}
              <code>pagehand.app</code> 的 API，再由它转发给模型路由（OpenRouter）
              以及最终提供该模型的厂商。
            </li>
            <li>
              <strong>自带 API 密钥</strong> — 你填入自己的厂商密钥，请求从你的浏览器直达该厂商。
              这条路径上 Pagehand 没有任何服务器参与，也收不到任何数据。
            </li>
          </ul>

          <h2>2. 账号数据（仅托管模式）</h2>
          <p>如果你从不登录，以下数据就不存在。登录会创建一个账号，其中包含：</p>
          <ul>
            <li>
              <strong>你的邮箱地址</strong> —
              用于发送登录链接并标识账号。认证与账号数据库由 Supabase 提供。
            </li>
            <li>
              <strong>会话令牌</strong> — 登录时签发并保存在你的设备上（见第 3
              条），使本扩展调用托管 API 时无需每次重新认证。
            </li>
            <li>
              <strong>用量记录</strong> — 每次托管请求记录：账号 id、所请求的模型、时间戳，
              以及该次请求的成本。用于计量、配额与防滥用。 你的消息内容不属于该记录，也不会被存储。
            </li>
          </ul>
          <p>
            你随时可以在侧栏退出登录，这会从设备上清除会话。 如需删除账号本身，请联系我们（第 9
            条）。
          </p>

          <h2>3. 存储在你设备上的数据</h2>
          <p>本扩展会将以下内容保存在你的 Chrome 配置中：</p>
          <ul>
            <li>
              <strong>LLM 设置</strong> — 提供商选择、模型名称、Base URL （如有自定义）以及 API
              密钥，保存在 <code>chrome.storage.local</code>。 密钥以未加密形式存放在浏览器配置中，不会通过
              Chrome Sync 同步到你的 Google 账号。
            </li>
            <li>
              <strong>托管会话</strong> — 你账号的 access / refresh 令牌，同样保存在{' '}
              <code>chrome.storage.local</code>，暴露面与上述密钥相同。
            </li>
            <li>
              <strong>对话线程</strong> — 对话历史（包括线程中保留的截图）保存在本机 IndexedDB。
            </li>
            <li>
              <strong>语言偏好</strong> — 你选择的界面语言。
            </li>
          </ul>

          <h2>4. 经网络发送的数据</h2>
          <p>
            当你与 Agent 对话时，提示词、来自页面的上下文（例如无障碍树快照、控制台 /
            网络摘录，以及你要求拍摄的截图）和工具结果，会发送到某个大语言模型提供商 —
            <em>你</em>自己配置的那家，或提供托管模型的那家。
          </p>
          <p>
            托管模式下，这些流量在前往路由与厂商的途中会经过 Pagehand 的
            API。它只做转发，我们不会将其写入数据库；保留的只有第 2 条中的用量记录。
            使用自己的密钥时，则完全不经过我们。
          </p>
          <p>数据到达提供商后，受其各自隐私政策约束；托管路径上还受 OpenRouter 的政策约束。</p>

          <h2>5. 权限与网页访问</h2>
          <p>
            Pagehand 使用 Chrome 的 <code>debugger</code> 权限（Chrome DevTools Protocol）
            来检查并控制已附着的网页。附着期间，Chrome 会显示持久横幅：
            「Pagehand is debugging this browser。」该横幅是 Chrome 安全机制，本扩展无法关闭。
          </p>
          <p>
            默认主机权限仅限内置提供商 API 主机。广泛站点访问 （<code>https://*/*</code>、
            <code>http://localhost/*</code>） 为可选，仅在需要时请求（例如自定义提供商 Base URL）。
          </p>

          <h2>6. 我们不收集的内容</h2>
          <ul>
            <li>不会在 Pagehand 的服务器上存储你的对话、页面内容或截图</li>
            <li>不会向 Pagehand 发送崩溃报告或使用分析</li>
            <li>没有广告标识符</li>
            <li>不会出售个人信息</li>
          </ul>
          <p>
            托管 API 的服务器日志记录的是请求元数据 — 时间、账号 id、模型、大小与成本 —
            不含消息内容。
          </p>

          <h2>7. 儿童</h2>
          <p>本扩展不面向 13 岁以下儿童，我们也不会故意收集儿童的个人信息。</p>

          <h2>8. 变更</h2>
          <p>
            若本政策发生实质性变更，上方「最近更新」日期将随之修订。
            更新后继续使用本扩展，即表示你接受修订后的政策。
          </p>

          <h2>9. 联系</h2>
          <p>
            关于本政策的问题，或申请删除账号：请发邮件至{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>，或在{' '}
            <a href={GITHUB_URL}>GitHub</a> 上提交 issue。
          </p>
        </article>
      </div>

      <Footer navLabel="页脚">
        <a href="/zh">首页</a>
      </Footer>
    </>
  );
}
