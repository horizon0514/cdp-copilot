import type { Metadata } from 'next';
import { TagLink, ZipLink } from '@/components/release';
import { LangSwitch } from '@/components/lang-switch';
import {
  Footer,
  GITHUB_URL,
  Grain,
  HeroStage,
  Nav,
  PREVIEW_REQUEST_URL,
  SITE_URL,
  STORE_URL,
} from '@/components/site';

export const metadata: Metadata = {
  title: 'Pagehand — 能操作当前网页的 AI',
  description:
    'Pagehand 是一款 Chrome 侧栏 AI，直接在你正打开的网页上干活 —— 总结页面、填写表单、走完多步流程、查清哪里出了错。登录即用，也可以自带 API 密钥。',
  alternates: {
    canonical: `${SITE_URL}/zh`,
    languages: { en: `${SITE_URL}/`, 'zh-CN': `${SITE_URL}/zh`, 'x-default': `${SITE_URL}/` },
  },
  openGraph: {
    title: 'Pagehand',
    description: '通过 CDP 读取并自动化当前 Chrome 网页的 AI。侧栏操作，登录即用，也可自带密钥。',
    type: 'website',
    locale: 'zh_CN',
  },
};

export default function ZhHome() {
  return (
    <>
      <Grain />

      <header className="hero">
        <HeroStage
          bound="已绑定 · help.acme.com"
          ask="帮我在这个网站找到退款政策，总结成三条。"
          tools={[
            { name: 'take_snapshot', note: '42 个节点' },
            { name: 'click', note: '链接「帮助中心」' },
            { name: 'extract_content', note: '退款与退货' },
          ]}
          doneLabel="完成"
          runningLabel="运行中"
          reply="三条：自签收起 30 天内可退；商品需未拆封；退款在他们收到货后 5–7 天到账。"
          placeholder="随便问点什么 — 用 @ 引用标签页"
        />

        <div className="wrap">
          <Nav
            navLabel="主导航"
            brandHref="/zh"
            githubLabel="在 GitHub 上查看 Pagehand"
            langSwitch={<LangSwitch label="语言" current="zh" enHref="/" zhHref="/zh" />}
          >
            <a className="hide-sm" href="#uses">
              能做什么
            </a>
            <a className="hide-sm" href="#install">
              安装
            </a>
            <a className="hide-sm" href="#modes">
              模型与密钥
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
              Pagehand 开在 Chrome 侧栏里，直接在你正看着的这个网页上干活 ——
              读它、填它、一步步点完它。你用大白话说，它替你做那些你懒得做的部分。
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" id="install-cta" href={STORE_URL}>
                添加到 Chrome
              </a>
              <a className="btn btn-ghost" href="#uses">
                看看它能做什么
              </a>
            </div>
            <p className="hero-meta">任何网页都能用 · 登录即用 · 对话只留在你的浏览器里</p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" id="uses">
          <div className="wrap">
            <p className="section-label">能做什么</p>
            <h2>大家最常让它做的四件事。</h2>
            <p className="section-lead">
              在任意网页打开侧栏，直接打字。下面每一句都可以原样粘进去用。
            </p>
            <ul className="scenarios">
              <li>
                <h3>帮我读这一页</h3>
                <p>
                  长文、密密麻麻的报告、懒得手抄的表格 —— 它读的是你屏幕上真实的这一页，
                  而不是搜出来的二手结果。
                </p>
                <p className="scenario-ask">「总结一下这份报告，把最关键的三个数字挑出来。」</p>
              </li>
              <li>
                <h3>帮我动手做</h3>
                <p>
                  填表单、勾选项、走完多步流程。它在你已经打开的这个标签页里操作，
                  所以你登录过的地方它都够得着。
                </p>
                <p className="scenario-ask">「按上次的信息把这张表填好，提交前停下来等我确认。」</p>
              </li>
              <li>
                <h3>把我几个标签页对着看</h3>
                <p>
                  打一个 <strong>@</strong> 就能把其他已打开的标签页交给它，
                  它会放在一起读，而不是一页一页来。
                </p>
                <p className="scenario-ask">「@ 这三个商品页 —— 算上运费哪个最便宜？」</p>
              </li>
              <li>
                <h3>告诉我这页为什么坏了</h3>
                <p>给写代码的同学：控制台报错和网络请求，它替你看完再讲给你听，不用自己开 DevTools。</p>
                <p className="scenario-ask">「点保存没反应 —— 是哪个请求失败了，返回了什么？」</p>
              </li>
            </ul>
          </div>
        </section>

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
                <p>
                  在任意网页点击 Pagehand 图标，或按 <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+
                  <kbd>K</kbd>。登录之后就能开始提问。
                </p>
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

        <section className="section" id="modes">
          <div className="wrap">
            <p className="section-label">模型来源</p>
            <h2>登录即用，或自带密钥。</h2>
            <p className="section-lead">
              两种拿到模型的方式。「手」都在本地 — Agent 循环和所有 CDP 工具都跑在你的浏览器里。
            </p>
            <ul className="modes">
              <li className="mode-default">
                <p className="mode-tag">托管 · 默认</p>
                <h3>登录即用</h3>
                <p>
                  一个邮箱，不用 API 密钥，也不用注册模型厂商账号。模型调用经由 Pagehand
                  自己的接口转发，账单我们出。
                </p>
                <ul className="mode-points">
                  <li>首次打开无需任何配置</li>
                  <li>对话记录依然只留在你的浏览器里</li>
                  <li>配额还在做，目前为私测</li>
                </ul>
              </li>
              <li>
                <p className="mode-tag">自带密钥 · 进阶</p>
                <h3>用你自己的密钥</h3>
                <p>
                  在侧栏填入 DeepSeek、OpenAI、Anthropic 或任意 OpenAI
                  兼容端点，请求从你的浏览器直连该厂商。
                </p>
                <ul className="mode-points">
                  <li>
                    密钥保存在 <code>chrome.storage.local</code>
                  </li>
                  <li>完全不经过 Pagehand 的服务器</li>
                  <li>厂商支持什么模型就能用什么，按其原价</li>
                </ul>
              </li>
            </ul>
            <div className="note-box modes-note">
              <p>
                托管模式目前是私测：登录可以正常完成，但在配额上线前只对少量账号放行。
                <a href={PREVIEW_REQUEST_URL}>发邮件申请体验 →</a>{' '}
                自带密钥则对所有人可用，连账号都不用注册。
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="wrap">
            <p className="section-label">隐私</p>
            <h2>它会读这个页面，仅此而已。</h2>
            <div className="privacy-box">
              <p>
                你问它的时候，它才看这一个标签页，也只看这一个。读到的内容只发给回答你的那个 AI
                模型，不去别的地方 ——
                我们不保存页面内容，对话记录也只留在你的浏览器里。它干活的时候，Chrome
                会在窗口顶部挂一条「Pagehand is debugging this browser」 的横幅：那是 Chrome
                在如实告诉你扩展正在做什么，我们无权关掉它，关闭侧栏它就消失。{' '}
                <a href="/zh/privacy">阅读完整隐私政策 →</a>
              </p>
            </div>
          </div>
        </section>

        {/* 放在最后但保留：它解释了「为什么点得动」，会翻到这里的人是专门来找答案的；
            但对大多数访客来说，这还不是他们此刻会问的问题。 */}
        <section className="section" id="how">
          <div className="wrap">
            <p className="section-label">技术细节</p>
            <h2>与 Puppeteer 同一套协议。</h2>
            <p className="section-lead">
              不需要 Node 旁路进程，不需要 MCP 桥接，也不是脆弱的 DOM 抓取。侧栏本身持有 Agent
              循环，在 Manifest V3 下通过 <code>chrome.debugger</code> 直接对话 Chrome DevTools
              Protocol。
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
            <p className="install-note">
              完整的工具列表和背后的代码都在 <a href={GITHUB_URL}>GitHub</a> 上。
            </p>
          </div>
        </section>
      </main>

      <Footer navLabel="页脚">
        <a href="/zh/privacy">隐私</a>
      </Footer>
    </>
  );
}
