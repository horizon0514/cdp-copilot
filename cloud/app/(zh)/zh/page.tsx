import type { Metadata } from 'next';
import { TagLink, ZipLink } from '@/components/release';
import { LangSwitch } from '@/components/lang-switch';
import { Footer, GITHUB_URL, Grain, HeroStage, Nav, SITE_URL, STORE_URL } from '@/components/site';

export const metadata: Metadata = {
  title: 'Pagehand — 能操作当前网页的 AI',
  description:
    'Pagehand 是一款 Chrome 侧栏 AI，通过 Chrome DevTools Protocol 读取并自动化当前网页。自带你的 API 密钥即可。',
  alternates: {
    canonical: `${SITE_URL}/zh`,
    languages: { en: `${SITE_URL}/`, 'zh-CN': `${SITE_URL}/zh`, 'x-default': `${SITE_URL}/` },
  },
  openGraph: {
    title: 'Pagehand',
    description: '通过 CDP 读取并自动化当前 Chrome 网页的 AI。侧栏操作，密钥自持，无中间云服务。',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function ZhHome() {
  return (
    <>
      <Grain />

      <header className="hero">
        <HeroStage />

        <div className="wrap">
          <Nav
            navLabel="主导航"
            brandHref="/zh"
            langSwitch={<LangSwitch label="语言" current="zh" enHref="/" zhHref="/zh" />}
          >
            <a className="hide-sm" href="#install">
              安装
            </a>
            <a className="hide-sm" href="#how">
              原理
            </a>
            <a className="hide-sm" href="#privacy">
              隐私
            </a>
          </Nav>

          <div className="hero-content">
            <p className="hero-brand">
              <img src="/icon.png" alt="" width={56} height={56} />
              Pagehand
            </p>
            <h1>能动手操作当前网页的 AI。</h1>
            <p className="hero-lead">
              Chrome 侧栏助手。读取页面、点击、填写表单，并查看控制台与网络 — 通过 CDP，使用你自己的
              API 密钥。
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" id="install-cta" href={STORE_URL}>
                添加到 Chrome
              </a>
              <a className="btn btn-ghost" href="#install">
                安装说明
              </a>
            </div>
            <p className="hero-meta">
              Manifest V3 · chrome.debugger · 自带 OpenAI / Anthropic / DeepSeek 密钥
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" id="install">
          <div className="wrap">
            <p className="section-label">安装</p>
            <h2>从 Chrome 应用商店安装。</h2>
            <p className="section-lead">
              一键装好，Chrome 自动更新。不用留压缩包，不用记文件夹，也不用开开发者模式。
            </p>
            <ol className="steps">
              <li>
                <h3>添加到 Chrome</h3>
                <p>
                  打开 <a href={STORE_URL}>Pagehand 商店页</a>，点击{' '}
                  <strong>添加至 Chrome</strong>。
                </p>
              </li>
              <li>
                <h3>固定到工具栏</h3>
                <p>点击工具栏的拼图图标，把 Pagehand 固定住，侧栏随时一键可达。</p>
              </li>
              <li>
                <h3>打开侧栏</h3>
                <p>在任意网页点击 Pagehand 图标，登录（或切换成自己的 API 密钥）就能开始提问。</p>
              </li>
            </ol>
            <p className="install-note">
              更新会自动完成。想自己从源码构建？{' '}
              <a href={`${GITHUB_URL}#setup`}>看 GitHub 说明</a>。
            </p>

            {/* 保留但不主推：只有在某个版本还没过审时才用得上，对其他人是六步加一个永远不能删的文件夹。 */}
            <details className="install-alt">
              <summary>想用「加载已解压的扩展程序」？</summary>
              <ol className="steps">
                <li>
                  <h3>下载</h3>
                  <p>
                    从 GitHub Release <TagLink idle="最新版" /> 下载{' '}
                    <ZipLink>pagehand.zip</ZipLink>。
                  </p>
                </li>
                <li>
                  <h3>解压</h3>
                  <p>
                    解压到一个你会长期保留的文件夹。Chrome
                    每次启动都会读取这个文件夹，装完后不要删掉。
                  </p>
                </li>
                <li>
                  <h3>打开扩展程序页</h3>
                  <p>
                    在 Chrome 地址栏输入 <kbd>chrome://extensions</kbd>，回车。
                  </p>
                </li>
                <li>
                  <h3>打开开发者模式</h3>
                  <p>
                    在页面右上角打开 <strong>开发者模式</strong> 开关。
                  </p>
                </li>
                <li>
                  <h3>加载已解压的扩展程序</h3>
                  <p>
                    点击 <strong>加载已解压的扩展程序</strong>，选中刚才解压出的文件夹 （里面应有{' '}
                    <code>manifest.json</code>）。
                  </p>
                </li>
              </ol>
              <p className="install-note">
                以后更新：下载新的 zip，覆盖原文件夹内容，再到 <kbd>chrome://extensions</kbd>{' '}
                点一下刷新图标。
              </p>
            </details>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <p className="section-label">原理</p>
            <h2>侧栏直接拥有调试器。</h2>
            <p className="section-lead">
              无需 Node 旁路进程，也无需 MCP 桥接。Pagehand 在扩展内部直接对话 Chrome DevTools
              Protocol，驱动你正在看的网页。
            </p>
            <ol className="steps">
              <li>
                <h3>打开侧栏</h3>
                <p>
                  <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd>，或点击工具栏图标。
                </p>
              </li>
              <li>
                <h3>填入密钥</h3>
                <p>默认 DeepSeek — OpenAI、Anthropic 或任意 OpenAI 兼容端点均可。</p>
              </li>
              <li>
                <h3>让它动手</h3>
                <p>总结页面、点击、填表、追查控制台错误，或在真实页面上走完多步流程。</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section" id="tools">
          <div className="wrap">
            <p className="section-label">能力</p>
            <h2>与 Puppeteer 同一套协议。</h2>
            <p className="section-lead">
              无障碍树快照、输入、导航、截图、控制台与网络 — 直接对接 CDP 域实现，而不是脆弱的 DOM
              抓取。
            </p>
            <ul className="feature-list">
              <li>
                <code>take_snapshot</code>
                <p>以结构化无障碍树读取页面，带稳定 uid。</p>
              </li>
              <li>
                <code>click / fill / type</code>
                <p>像真人一样操作表单与界面 — 包括替换前先全选。</p>
              </li>
              <li>
                <code>navigate / pages</code>
                <p>在网页间跳转并管理页面，Agent 保持上下文。</p>
              </li>
              <li>
                <code>console / network</code>
                <p>无需亲自打开 DevTools，即可查看错误与请求。</p>
              </li>
              <li>
                <code>evaluate_script</code>
                <p>读树不够时，运行针对性的页面脚本。</p>
              </li>
              <li>
                <code>take_screenshot</code>
                <p>捕获网页画面，并保留在对话线程中。</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="wrap">
            <p className="section-label">隐私</p>
            <h2>你的密钥不会经我们的服务器离开本机。</h2>
            <div className="privacy-box">
              <p>
                Pagehand 没有后端。API 密钥保存在 <code>chrome.storage.local</code>{' '}
                中，仅发送给你选择的模型提供商。附着调试时，Chrome 会显示 「Pagehand is debugging
                this browser」横幅 — 这是有意为之，且无法隐藏。{' '}
                <a href="/zh/privacy">阅读完整隐私政策 →</a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer navLabel="页脚">
        <a href="/zh/privacy">隐私</a>
      </Footer>
    </>
  );
}
